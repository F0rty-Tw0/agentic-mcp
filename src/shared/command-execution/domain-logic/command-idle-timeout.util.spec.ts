import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { killProcess } from '../utils';
import { setupIdleTimeout } from './command-idle-timeout.util';

vi.mock('../utils', () => ({
  killProcess: vi.fn().mockResolvedValue(undefined),
}));

const killProcessMock = vi.mocked(killProcess);

describe('setupIdleTimeout', () => {
  beforeEach(() => {
    killProcessMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN no idleTimeoutMs', () => {
    it('WHEN undefined THEN returns noop handle', () => {
      const handle = setupIdleTimeout(undefined, 1234);

      expect(handle.reset).toBeTypeOf('function');
      expect(handle.clear).toBeTypeOf('function');
      handle.reset();
      handle.clear();
    });

    it('WHEN zero THEN returns noop handle', () => {
      const handle = setupIdleTimeout(0, 1234);

      expect(handle.reset).toBeTypeOf('function');
      expect(handle.clear).toBeTypeOf('function');
    });
  });

  describe('GIVEN no pid', () => {
    it('WHEN pid is undefined THEN returns noop handle', () => {
      const handle = setupIdleTimeout(5000, undefined);

      expect(handle.reset).toBeTypeOf('function');
      expect(handle.clear).toBeTypeOf('function');
    });
  });

  describe('GIVEN valid idleTimeoutMs and pid', () => {
    it('WHEN reset is called and idle period elapses THEN kills the process', async () => {
      vi.useFakeTimers();
      const handle = setupIdleTimeout(100, 9999);

      handle.reset();
      await vi.advanceTimersByTimeAsync(100);

      expect(killProcessMock).toHaveBeenCalledWith(9999);
    });

    it('WHEN reset is called again before timeout THEN restarts the timer', async () => {
      vi.useFakeTimers();
      const handle = setupIdleTimeout(100, 9999);

      handle.reset();
      await vi.advanceTimersByTimeAsync(80);

      handle.reset();
      await vi.advanceTimersByTimeAsync(80);

      expect(killProcessMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(20);

      expect(killProcessMock).toHaveBeenCalledOnce();
    });

    it('WHEN clear is called before timeout THEN process is not killed', async () => {
      vi.useFakeTimers();
      const handle = setupIdleTimeout(100, 9999);

      handle.reset();
      await vi.advanceTimersByTimeAsync(50);

      handle.clear();
      await vi.advanceTimersByTimeAsync(200);

      expect(killProcessMock).not.toHaveBeenCalled();
    });

    it('WHEN reset is never called THEN no timer is scheduled', async () => {
      vi.useFakeTimers();
      setupIdleTimeout(100, 9999);

      await vi.advanceTimersByTimeAsync(200);

      expect(killProcessMock).not.toHaveBeenCalled();
    });
  });
});
