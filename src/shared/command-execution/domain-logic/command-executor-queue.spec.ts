import type { ChildProcess } from 'node:child_process';

import crossSpawn from 'cross-spawn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommand } from './command-executor';
import { QueueTimeoutError } from '../common/errors';
import { TEST_EXECUTE_COMMAND_OPTIONS_STUB } from '../common/stubs';
import { createControllableChild } from '../common/test-utils';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));
vi.mock('../utils/platform.util', () => ({ killProcess: vi.fn().mockResolvedValue(true) }));

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
});
