import type { ProviderConfig } from "../../../shared/common";

export const TOOL_REGISTRY_PROVIDER_CONFIG_STUB: ProviderConfig = {
  enabled: true,
  description: 'test provider',
  command: 'test-cli',
  timeout: 30_000,
  env: {},
  outputFormat: 'text',
  commands: { ask: { args: ['exec'], flags: { model: '-m' } } },
  input: { method: 'positional' },
};
