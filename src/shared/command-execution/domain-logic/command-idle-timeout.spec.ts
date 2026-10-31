import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupIdleTimeout } from './command-idle-timeout';
import type { StopChild } from '../common';

const stopChildMock = vi.fn<StopChild>();

describe('setupIdleTimeout', () => {
  beforeEach(() => {
    stopChildMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN no idleTimeoutMs', () => {
    it('WHEN undefined THEN returns noop handle', () => {
      const handle = setupIdleTimeout(undefined, stopChildMock);

      expect(handle.reset).toBeTypeOf('function');
      expect(handle.clear).toBeTypeOf('function');
      handle.reset();
      handle.clear();
    });

    it('WHEN zero THEN returns noop handle', () => {
      const handle = setupIdleTimeout(0, stopChildMock);

      expect(handle.reset).toBeTypeOf('function');
      expect(handle.clear).toBeTypeOf('function');
    });

    it('WHEN the noop handle is asked THEN it reports no idle timeout', () => {
      const handle = setupIdleTimeout(undefined, stopChildMock);

      expect(handle.timedOut()).toBe(false);
    });
  });

  describe('GIVEN no stop action', () => {
    it('WHEN the stop action is undefined THEN returns noop handle', () => {
      const handle = setupIdleTimeout(5000, undefined);

      expect(handle.reset).toBeTypeOf('function');
      expect(handle.clear).toBeTypeOf('function');
    });
  });

  describe('GIVEN valid idleTimeoutMs and a stop action', () => {
    it('WHEN reset is called and idle period elapses THEN kills the process', async () => {
      vi.useFakeTimers();
      const handle = setupIdleTimeout(100, stopChildMock);

      handle.reset();
      await vi.advanceTimersByTimeAsync(100);

      expect(stopChildMock).toHaveBeenCalledOnce();
    });

    it('WHEN reset is called again before timeout THEN restarts the timer', async () => {
      vi.useFakeTimers();
      const handle = setupIdleTimeout(100, stopChildMock);

      handle.reset();
      await vi.advanceTimersByTimeAsync(80);

      handle.reset();
      await vi.advanceTimersByTimeAsync(80);

      expect(stopChildMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(20);

      expect(stopChildMock).toHaveBeenCalledOnce();
    });

    it('WHEN clear is called before timeout THEN process is not killed', async () => {
      vi.useFakeTimers();
      const handle = setupIdleTimeout(100, stopChildMock);

      handle.reset();
      await vi.advanceTimersByTimeAsync(50);

      handle.clear();
      await vi.advanceTimersByTimeAsync(200);

      expect(stopChildMock).not.toHaveBeenCalled();
    });

    it('WHEN no output ever arrives THEN no idle kill is scheduled (the overall timeout covers silent starts)', async () => {
      vi.useFakeTimers();
      setupIdleTimeout(100, stopChildMock);

      await vi.advanceTimersByTimeAsync(200);

      expect(stopChildMock).not.toHaveBeenCalled();
    });

    it('WHEN the idle period elapses after output THEN the handle reports an idle timeout', async () => {
      vi.useFakeTimers();
      const handle = setupIdleTimeout(100, stopChildMock);

      handle.reset();
      await vi.advanceTimersByTimeAsync(100);

      expect(handle.timedOut()).toBe(true);
    });

    it('WHEN output keeps arriving within the idle period THEN the handle reports no idle timeout', async () => {
      vi.useFakeTimers();
      const handle = setupIdleTimeout(100, stopChildMock);

      await vi.advanceTimersByTimeAsync(80);
      handle.reset();
      await vi.advanceTimersByTimeAsync(80);

      expect(handle.timedOut()).toBe(false);
    });
  });
});
