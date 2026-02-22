import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startHeartbeat } from './heartbeat.util.ts';
import type { ProgressContext } from '../common/index.ts';

const createExtra = (token?: string | number): ProgressContext => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  ['_meta']: token != null ? { progressToken: token } : {},
});

describe('startHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('no-op paths', () => {
    it('GIVEN undefined extra WHEN called THEN returns a stop function without sending notifications', () => {
      const stop = startHeartbeat(undefined);

      expect(stop).toBeTypeOf('function');
    });

    it('GIVEN extra without sendNotification WHEN called THEN returns a stop function without sending notifications', () => {
      const stop = startHeartbeat({} as ProgressContext);

      expect(stop).toBeTypeOf('function');
    });
  });

  describe('immediate heartbeat', () => {
    it('GIVEN extra with progressToken WHEN called THEN sends immediate notification with progress 0', () => {
      const extra = createExtra('tok-1');

      startHeartbeat(extra);

      expect(extra.sendNotification).toHaveBeenCalledTimes(1);
      expect(extra.sendNotification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'tok-1',
          progress: 0,
          message: 'Processing… (0s elapsed)',
        },
      });
    });

    it('GIVEN extra with numeric progressToken WHEN called THEN uses the numeric token as-is', () => {
      const extra = createExtra(42);

      startHeartbeat(extra);

      expect(extra.sendNotification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 42,
          progress: 0,
          message: 'Processing… (0s elapsed)',
        },
      });
    });

    it('GIVEN extra without progressToken WHEN called THEN generates a UUID-based token', () => {
      const extra = createExtra();

      startHeartbeat(extra);

      expect(extra.sendNotification).toHaveBeenCalledTimes(1);

      const serialized = JSON.stringify(vi.mocked(extra.sendNotification).mock.calls);

      expect(serialized).toContain('agentic-mcp-heartbeat-');
    });
  });

  describe('interval heartbeats', () => {
    it('GIVEN active heartbeat WHEN 30s elapses THEN sends second notification with progress 1', async () => {
      const extra = createExtra('tok-1');

      startHeartbeat(extra);

      await vi.advanceTimersByTimeAsync(30_000);

      expect(extra.sendNotification).toHaveBeenCalledTimes(2);
      expect(extra.sendNotification).toHaveBeenLastCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'tok-1',
          progress: 1,
          message: 'Processing… (30s elapsed)',
        },
      });
    });

    it('GIVEN active heartbeat WHEN 90s elapses THEN sends 4 notifications with incrementing progress', async () => {
      const extra = createExtra('tok-1');

      startHeartbeat(extra);

      await vi.advanceTimersByTimeAsync(90_000);

      expect(extra.sendNotification).toHaveBeenCalledTimes(4);

      const notification = (progress: number, seconds: number): Record<string, unknown> => ({
        method: 'notifications/progress',
        params: { progressToken: 'tok-1', progress, message: `Processing… (${seconds}s elapsed)` },
      });

      expect(extra.sendNotification).toHaveBeenNthCalledWith(1, notification(0, 0));
      expect(extra.sendNotification).toHaveBeenNthCalledWith(2, notification(1, 30));
      expect(extra.sendNotification).toHaveBeenNthCalledWith(3, notification(2, 60));
      expect(extra.sendNotification).toHaveBeenNthCalledWith(4, notification(3, 90));
    });
  });

  describe('stop function', () => {
    it('GIVEN active heartbeat WHEN stop is called THEN no further notifications are sent', async () => {
      const extra = createExtra('tok-1');

      const stop = startHeartbeat(extra);

      expect(extra.sendNotification).toHaveBeenCalledTimes(1);

      stop();

      await vi.advanceTimersByTimeAsync(60_000);

      expect(extra.sendNotification).toHaveBeenCalledTimes(1);
    });

    it('GIVEN no-op heartbeat WHEN stop is called THEN does not throw', () => {
      const stop = startHeartbeat(undefined);

      expect(() => stop()).not.toThrow();
    });
  });

  describe('notification failure resilience', () => {
    it('GIVEN sendNotification rejects WHEN heartbeat fires THEN error is swallowed and next heartbeat still fires', async () => {
      const extra = createExtra('tok-1');

      vi.mocked(extra.sendNotification).mockRejectedValue(new Error('transport closed'));

      startHeartbeat(extra);

      await vi.advanceTimersByTimeAsync(30_000);

      expect(extra.sendNotification).toHaveBeenCalledTimes(2);
    });
  });
});
