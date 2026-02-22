import type { ProviderConfig } from '../provider-config.schema.ts';

export const TEST_PROVIDER_CONFIG_STUB: ProviderConfig = {
  enabled: true,
  description: 'Test provider',
  command: 'test-cli',
  timeout: 120_000,
  env: {},
  outputFormat: 'json',
  commands: { ask: { args: ['exec'], flags: {} } },
  input: { method: 'positional' },
};
