import type { ChildProcess } from 'node:child_process';

import crossSpawn from 'cross-spawn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommand } from './command-executor';
import { killProcess } from './platform';
import type { ExecutionTimeoutCause } from '../common';
import { TEST_EXECUTE_COMMAND_OPTIONS_STUB } from '../test/stubs/execute-command-options.stub';
import { createControllableChild } from '../test/utils/controllable-child.spec.util';

vi.mock('cross-spawn', () => {
  const mockedModule = { default: vi.fn() };

  return mockedModule;
});

vi.mock('./platform', () => {
  const killProcessMock = vi.fn().mockResolvedValue(true);
  const mockedModule = {
    killProcess: killProcessMock,
  };

  return mockedModule;
});

describe('executeCommand timeouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('no timeout', () => {
    it('GIVEN a command that exits on its own WHEN executed THEN the result carries no timeout cause', async () => {
      const { child, emitClose } = createControllableChild(1357);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ChildProcess);

      const resultPromise = executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true });

      emitClose(0, null);

      const result = await resultPromise;

      expect(result.timeoutCause).toBeUndefined();
    });
  });

  describe('timeout', () => {
    it('GIVEN a process exceeding timeoutMs WHEN timeout fires THEN timedOut is true and killProcess is called', async () => {
      vi.useFakeTimers();

      const { child, emitClose } = createControllableChild(1234);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ChildProcess);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        timeoutMs: 5_000,
        bypassSemaphore: true,
      });

      vi.advanceTimersByTime(5_001);
      emitClose(null, 'SIGTERM');

      vi.useRealTimers();

      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
      expect(killProcess).toHaveBeenCalledWith(1234, { childExited: false });
    });

    it('GIVEN a process exceeding timeoutMs WHEN timeout fires THEN the result names the wall-clock limit as the cause', async () => {
      vi.useFakeTimers();

      const { child, emitClose } = createControllableChild(1234);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ChildProcess);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        timeoutMs: 5_000,
        bypassSemaphore: true,
      });

      vi.advanceTimersByTime(5_001);
      emitClose(null, 'SIGTERM');

      vi.useRealTimers();

      const result = await resultPromise;
      const expectedCause: ExecutionTimeoutCause = { kind: 'wall-clock', limitMs: 5_000 };

      expect(result.timeoutCause).toStrictEqual(expectedCause);
    });

    it('GIVEN a process with no pid WHEN timeout fires THEN killProcess is not called', async () => {
      vi.useFakeTimers();

      const { child, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ChildProcess);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        timeoutMs: 5_000,
        bypassSemaphore: true,
      });

      vi.advanceTimersByTime(5_001);
      emitClose(null, null);

      vi.useRealTimers();

      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
      expect(killProcess).not.toHaveBeenCalled();
    });
  });

  describe('idle timeout', () => {
    it('GIVEN a process that goes silent after output WHEN the idle period elapses THEN timedOut is true', async () => {
      vi.useFakeTimers();

      const { child, emitClose, emitStdout } = createControllableChild(2468);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ChildProcess);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        idleTimeoutMs: 1_000,
        bypassSemaphore: true,
      });

      emitStdout(Buffer.from('partial'));
      vi.advanceTimersByTime(1_001);
      emitClose(null, 'SIGTERM');

      vi.useRealTimers();

      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
    });

    it('GIVEN a process that goes silent after output WHEN the idle period elapses THEN the result names the idle limit as the cause', async () => {
      vi.useFakeTimers();

      const { child, emitClose, emitStdout } = createControllableChild(2468);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ChildProcess);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        idleTimeoutMs: 1_000,
        bypassSemaphore: true,
      });

      emitStdout(Buffer.from('partial'));
      vi.advanceTimersByTime(1_001);
      emitClose(null, 'SIGTERM');

      vi.useRealTimers();

      const result = await resultPromise;
      const expectedCause: ExecutionTimeoutCause = { kind: 'idle', limitMs: 1_000 };

      expect(result.timeoutCause).toStrictEqual(expectedCause);
    });
  });
});
