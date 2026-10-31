import { describe, expect, it } from 'vitest';

import { buildProviderQueueOptions } from './provider-queue-options.util';
import type { ProviderQueueOptions } from '../../command-execution/common';
import type { ResolvedProviderEntry } from '../common';
import { TEST_PROVIDER_CONFIG_STUB, TEST_RESOLVED_PROVIDER_ENTRY_STUB } from '../test/stubs';

const TEN_MINUTES_MS = 600_000;

describe('FEATURE: buildProviderQueueOptions', () => {
  describe('GIVEN a provider config without maxConcurrency or queueTimeoutMs', () => {
    it('WHEN building queue options THEN one slot is allowed and a request waits up to 10 minutes for it', () => {
      const result = buildProviderQueueOptions(TEST_RESOLVED_PROVIDER_ENTRY_STUB);
      const expected: ProviderQueueOptions = {
        providerName: 'test',
        maxConcurrency: 1,
        queueTimeoutMs: TEN_MINUTES_MS,
      };

      expect(result).toStrictEqual(expected);
    });
  });

  describe('GIVEN a provider config with maxConcurrency and queueTimeoutMs', () => {
    it('WHEN building queue options THEN the configured values are used', () => {
      const config = { ...TEST_PROVIDER_CONFIG_STUB, maxConcurrency: 2, queueTimeoutMs: 5_000 };
      const context: ResolvedProviderEntry = { ...TEST_RESOLVED_PROVIDER_ENTRY_STUB, config };
      const result = buildProviderQueueOptions(context);
      const expected: ProviderQueueOptions = { providerName: 'test', maxConcurrency: 2, queueTimeoutMs: 5_000 };

      expect(result).toStrictEqual(expected);
    });
  });
});
