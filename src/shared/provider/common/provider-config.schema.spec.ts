import { describe, expect, it } from 'vitest';

import type { ProviderConfig, ProvidersFile } from './provider-config.schema';
import { providersFileSchema } from './provider-config.schema';
import { MAX_TIMER_DELAY_MS } from './provider-timeout.const';
import { TEST_PROVIDER_CONFIG_STUB } from '../test/stubs';

const buildProvidersFile = (overrides: Partial<ProviderConfig>): ProvidersFile => {
  const provider: ProviderConfig = { ...TEST_PROVIDER_CONFIG_STUB, ...overrides };
  const providers = { test: provider };
  const providersFile: ProvidersFile = { configVersion: 1, providers };

  return providersFile;
};

const isValid = (overrides: Partial<ProviderConfig>): boolean => {
  const parsed = providersFileSchema.safeParse(buildProvidersFile(overrides));

  return parsed.success;
};

describe('FEATURE: provider config schema', () => {
  describe('GIVEN a timer field above the Node setTimeout limit', () => {
    it('WHEN timeout is 2^31 ms THEN the config is rejected', () => {
      const valid = isValid({ timeout: MAX_TIMER_DELAY_MS + 1 });

      expect(valid).toBe(false);
    });

    it('WHEN idleTimeout is 2^31 ms THEN the config is rejected', () => {
      const valid = isValid({ idleTimeout: MAX_TIMER_DELAY_MS + 1 });

      expect(valid).toBe(false);
    });

    it('WHEN resultExitGraceMs is 2^31 ms THEN the config is rejected', () => {
      const valid = isValid({ resultExitGraceMs: MAX_TIMER_DELAY_MS + 1 });

      expect(valid).toBe(false);
    });

    it('WHEN queueTimeoutMs is 2^31 ms THEN the config is rejected', () => {
      const valid = isValid({ queueTimeoutMs: MAX_TIMER_DELAY_MS + 1 });

      expect(valid).toBe(false);
    });
  });

  describe('GIVEN timer fields at the Node setTimeout limit', () => {
    it('WHEN timeout, idleTimeout and queueTimeoutMs are 2^31-1 ms THEN the config is accepted', () => {
      const valid = isValid({
        timeout: MAX_TIMER_DELAY_MS,
        idleTimeout: MAX_TIMER_DELAY_MS,
        queueTimeoutMs: MAX_TIMER_DELAY_MS,
      });

      expect(valid).toBe(true);
    });
  });

  describe('GIVEN the acceptResultOnTimeout opt-in', () => {
    it('WHEN it is true THEN the parsed config keeps it', () => {
      const providersFile = buildProvidersFile({ acceptResultOnTimeout: true });

      const parsed = providersFileSchema.parse(providersFile);

      expect(parsed.providers.test?.acceptResultOnTimeout).toBe(true);
    });

    it('WHEN resultExitGraceMs is set THEN the parsed config keeps it', () => {
      const providersFile = buildProvidersFile({ acceptResultOnTimeout: true, resultExitGraceMs: 10_000 });

      const parsed = providersFileSchema.parse(providersFile);

      expect(parsed.providers.test?.resultExitGraceMs).toBe(10_000);
    });

    it('WHEN it is not a boolean THEN the config is rejected', () => {
      const providersFile = buildProvidersFile({});
      const provider = { ...providersFile.providers.test, acceptResultOnTimeout: 'yes' };
      const providers = { test: provider };
      const invalidFile = { ...providersFile, providers };

      const parsed = providersFileSchema.safeParse(invalidFile);

      expect(parsed.success).toBe(false);
    });
  });
});
