import type { ProviderConfig } from '../../../shared';

const ask = { args: ['exec'], flags: {} };
const commands = { ask };
const input = { method: 'positional' } as const;

export const ASK_PROVIDER_CONFIG_STUB: ProviderConfig = {
  enabled: true,
  description: 'Test provider',
  command: 'test-cli',
  timeout: 120_000,
  env: {},
  outputFormat: 'json',
  commands,
  input,
};
