import type { ChildProcess } from 'node:child_process';

import crossSpawn from 'cross-spawn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommand } from './command-executor';
import { CommandExecutionError, QueueTimeoutError } from '../common/errors';
import { TEST_EXECUTE_COMMAND_OPTIONS_STUB } from '../test/stubs';
import { createControllableChild } from '../test/utils/controllable-child.spec.util';

vi.mock('cross-spawn', () => {
  const mockedModule = { default: vi.fn() };

  return mockedModule;
});
vi.mock('./platform', () => {
  const killProcessMock = vi.fn().mockResolvedValue(true);
  const mockedModule = { killProcess: killProcessMock };

  return mockedModule;
});

type CrossSpawnResult = ChildProcess;

const queueConfig = {
  providerName: 'codex',
  maxConcurrency: 1,
  queueTimeoutMs: 50,
} as const;

describe('executeCommand provider queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('GIVEN a queued provider request WHEN queueTimeoutMs expires before spawn THEN it rejects with QueueTimeoutError', async () => {
    vi.useFakeTimers();

    const first = createControllableChild();

    vi.mocked(crossSpawn).mockReturnValue(first.child as unknown as CrossSpawnResult);

    const firstPromise = executeCommand({
      ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
      providerQueue: queueConfig,
      bypassSemaphore: false,
    });

    await Promise.resolve();

    const secondPromise = executeCommand({
      ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
      providerQueue: queueConfig,
      bypassSemaphore: false,
    });
    const caughtSecondPromise = secondPromise.catch((value: unknown) => value);

    await vi.advanceTimersByTimeAsync(51);

    const error = await caughtSecondPromise;

    expect(error).toBeInstanceOf(QueueTimeoutError);
    expect(crossSpawn).toHaveBeenCalledTimes(1);

    first.emitClose(0, null);
    await firstPromise;
  });
  it('GIVEN a queued provider request WHEN its signal aborts before spawn THEN it rejects without starting the provider CLI', async () => {
    const first = createControllableChild();
    const second = createControllableChild();
    const controller = new AbortController();

    const crossSpawnMock = vi.mocked(crossSpawn);

    crossSpawnMock.mockReturnValueOnce(first.child as unknown as CrossSpawnResult);
    crossSpawnMock.mockReturnValueOnce(second.child as unknown as CrossSpawnResult);

    const firstPromise = executeCommand({
      ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
      providerQueue: queueConfig,
      bypassSemaphore: false,
    });

    await Promise.resolve();

    const secondPromise = executeCommand({
      ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
      providerQueue: queueConfig,
      bypassSemaphore: false,
      signal: controller.signal,
    });
    const caughtSecondPromise = secondPromise.catch((value: unknown) => value);

    controller.abort();
    await Promise.resolve();

    first.emitClose(0, null);
    second.emitClose(0, null);

    await firstPromise;

    const error = await caughtSecondPromise;

    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(crossSpawn).toHaveBeenCalledTimes(1);
  });
});
