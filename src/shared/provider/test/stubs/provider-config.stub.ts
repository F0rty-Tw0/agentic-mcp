import type { ProviderConfig } from '../../common/provider-config.schema';

const ask = { args: ['exec'], flags: {} };
const commands = { ask };
const input: ProviderConfig['input'] = { method: 'positional' };

export const TEST_PROVIDER_CONFIG_STUB: ProviderConfig = {
  enabled: true,
  description: 'Test provider',
  command: 'test-cli',
  timeout: 120_000,
  env: {},
  outputFormat: 'json',
  commands,
  input,
};
