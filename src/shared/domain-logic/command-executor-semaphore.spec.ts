import crossSpawn from 'cross-spawn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommand } from './command-executor';
import { TEST_EXECUTE_COMMAND_OPTIONS_STUB } from '../common/stubs';
import { createControllableChild } from '../common/test-utils';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));
vi.mock('../utils/platform.util', () => ({ killProcess: vi.fn().mockResolvedValue(true) }));

const baseOptions = { ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: false };

const drainMicrotasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('executeCommand semaphore concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN 5 in-flight commands WHEN a 6th is queued THEN it waits until a slot is released', async () => {
    const children = Array.from({ length: 6 }, () => createControllableChild());
    let callIndex = 0;

    vi.mocked(crossSpawn).mockImplementation(() => {
      const child = children[callIndex];
      const resolvedChild = child ?? children[0];

      callIndex += 1;

      expect(resolvedChild).toBeDefined();

      return resolvedChild?.child as unknown as ReturnType<typeof crossSpawn>;
    });

    const runCommand = async (): Promise<Awaited<ReturnType<typeof executeCommand>>> => executeCommand(baseOptions);
    const promises = Array.from({ length: 6 }, runCommand);

    await drainMicrotasks();
    expect(crossSpawn).toHaveBeenCalledTimes(5);

    children[0]?.emitClose(0, null);

    await drainMicrotasks();
    expect(crossSpawn).toHaveBeenCalledTimes(6);

    children.slice(1).forEach((child) => {
      child.emitClose(0, null);
    });

    await Promise.all(promises);
  });

  it('GIVEN 5 in-flight commands and one fails with spawn error WHEN slot is released THEN queued command proceeds', async () => {
    const children = Array.from({ length: 6 }, () => createControllableChild());
    let callIndex = 0;

    vi.mocked(crossSpawn).mockImplementation(() => {
      const child = children[callIndex];
      const resolvedChild = child ?? children[0];

      callIndex += 1;

      expect(resolvedChild).toBeDefined();

      return resolvedChild?.child as unknown as ReturnType<typeof crossSpawn>;
    });

    const promises = Array.from({ length: 6 }, async () => executeCommand(baseOptions));

    // Suppress unhandled rejection from the command that will error
    promises.forEach((promise) => {
      void promise.catch(vi.fn());
    });

    await drainMicrotasks();
    expect(crossSpawn).toHaveBeenCalledTimes(5);

    children[0]?.emitError(new Error('ENOENT'));

    await drainMicrotasks();
    expect(crossSpawn).toHaveBeenCalledTimes(6);

    children.slice(1).forEach((child) => {
      child.emitClose(0, null);
    });

    await Promise.allSettled(promises);
  });
});
