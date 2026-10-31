import { describe, expect, it } from 'vitest';

import { resolveTimeoutCause } from './execution-result.util';
import type { ExecutionTimeoutCause } from '../common';

describe('FEATURE: resolveTimeoutCause', () => {
  describe('GIVEN the wall-clock and idle timers both fired', () => {
    it('WHEN resolving the cause THEN the wall-clock limit wins', () => {
      const result = resolveTimeoutCause({
        wallClockTimedOut: true,
        idleTimedOut: true,
        resultExitStopped: false,
        timeoutMs: 5_000,
        idleTimeoutMs: 1_000,
      });
      const expected: ExecutionTimeoutCause = { kind: 'wall-clock', limitMs: 5_000 };

      expect(result).toStrictEqual(expected);
    });
  });

  describe('GIVEN only the idle timer fired', () => {
    it('WHEN resolving the cause THEN the idle limit is named', () => {
      const result = resolveTimeoutCause({
        wallClockTimedOut: false,
        idleTimedOut: true,
        resultExitStopped: false,
        timeoutMs: 5_000,
        idleTimeoutMs: 1_000,
      });
      const expected: ExecutionTimeoutCause = { kind: 'idle', limitMs: 1_000 };

      expect(result).toStrictEqual(expected);
    });
  });

  describe('GIVEN the child was stopped after a complete result', () => {
    it('WHEN resolving the cause THEN result-exit wins over the timers', () => {
      const result = resolveTimeoutCause({
        wallClockTimedOut: true,
        idleTimedOut: false,
        resultExitStopped: true,
        timeoutMs: 5_000,
      });

      expect(result?.kind).toBe('result-exit');
    });
  });

  describe('GIVEN neither timer fired', () => {
    it('WHEN resolving the cause THEN there is none', () => {
      const result = resolveTimeoutCause({
        wallClockTimedOut: false,
        idleTimedOut: false,
        resultExitStopped: false,
        timeoutMs: 5_000,
      });

      expect(result).toBeUndefined();
    });
  });
});
