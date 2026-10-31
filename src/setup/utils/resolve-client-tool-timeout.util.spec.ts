import { describe, expect, it } from 'vitest';

import {
  buildDefaultClientToolTimeout,
  describeClientToolTimeout,
  resolveClientToolTimeout,
} from './resolve-client-tool-timeout.util';
import type { ClientToolTimeout } from '../common';

const PROVIDER_TIMEOUTS = { enabled: true, timeout: 3_600_000, queueTimeoutMs: 600_000 };

describe('FEATURE: client tool-call timeout from the providers config', () => {
  describe('GIVEN enabled providers with different timeouts', () => {
    it('WHEN resolving THEN it adds the longest run, the longest queue wait and one minute', () => {
      const slowRun = { enabled: true, timeout: 5_400_000, queueTimeoutMs: 60_000 };
      const longQueue = { enabled: true, timeout: 600_000, queueTimeoutMs: 1_200_000 };

      const result = resolveClientToolTimeout([slowRun, longQueue]);

      expect(result).toStrictEqual({
        ms: 6_660_000,
        runMs: 5_400_000,
        queueMs: 1_200_000,
        source: 'providers-config',
      });
    });
  });

  describe('GIVEN a provider without queueTimeoutMs', () => {
    it('WHEN resolving THEN its queue wait is the 10 min default the queue uses', () => {
      const result = resolveClientToolTimeout([{ enabled: true, timeout: 600_000 }]);

      expect(result.queueMs).toBe(600_000);
    });
  });

  describe('GIVEN a provider with timeout 0', () => {
    it('WHEN resolving THEN its run is the 60 min default the ask handler uses', () => {
      const result = resolveClientToolTimeout([{ enabled: true, timeout: 0, queueTimeoutMs: 0 }]);

      expect(result.ms).toBe(4_260_000);
    });
  });

  describe('GIVEN a disabled provider with a longer timeout', () => {
    it('WHEN resolving THEN it is ignored, since the server does not serve it', () => {
      const disabled = { enabled: false, timeout: 7_200_000, queueTimeoutMs: 600_000 };

      const result = resolveClientToolTimeout([PROVIDER_TIMEOUTS, disabled]);

      expect(result.runMs).toBe(3_600_000);
    });
  });

  describe('GIVEN no enabled provider', () => {
    it('WHEN resolving THEN the defaults are used and the reason says why', () => {
      const result = resolveClientToolTimeout([]);

      expect(result).toStrictEqual(buildDefaultClientToolTimeout('no provider is enabled in it'));
    });
  });

  describe('GIVEN timeouts whose sum passes the 2^31-1 ms timer limit', () => {
    it('WHEN resolving THEN the value is capped, since a Node client fires a longer timer at once', () => {
      const result = resolveClientToolTimeout([{ enabled: true, timeout: 2_147_483_647, queueTimeoutMs: 600_000 }]);

      expect(result.ms).toBe(2_147_483_647);
    });
  });
});

describe('FEATURE: client tool-call timeout note', () => {
  describe('GIVEN a value from the providers config', () => {
    it('WHEN describing THEN the note shows the sum', () => {
      const timeout: ClientToolTimeout = resolveClientToolTimeout([PROVIDER_TIMEOUTS]);

      const result = describeClientToolTimeout(timeout);

      expect(result).toBe(
        'agentic-mcp tool-call timeout: 4260000 ms = longest provider timeout 3600000 + longest queueTimeoutMs 600000 + 60000, from the providers config.'
      );
    });
  });

  describe('GIVEN the defaults', () => {
    it('WHEN describing THEN the note says the defaults were used and why', () => {
      const timeout = buildDefaultClientToolTimeout('the providers config could not be loaded');

      const result = describeClientToolTimeout(timeout);

      expect(result).toBe(
        'agentic-mcp tool-call timeout: 4260000 ms = default provider timeout 3600000 + default queueTimeoutMs 600000 + 60000, since the providers config could not be loaded.'
      );
    });
  });
});
