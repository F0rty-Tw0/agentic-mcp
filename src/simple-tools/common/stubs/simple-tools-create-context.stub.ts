import { SIMPLE_TOOLS_PROVIDER_CONFIG_STUB } from './simple-tools-provider-config.stub.ts';
import { SIMPLE_TOOLS_RESOLVED_PROVIDER_ENTRY_STUB } from './simple-tools-resolved-provider-entry.stub.ts';
import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/common/index.ts';

export const createSimpleToolsContext = (overrides: Partial<ProviderConfig> = {}): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    ...SIMPLE_TOOLS_PROVIDER_CONFIG_STUB,
    ...overrides,
  };

  const context: ResolvedProviderEntry = {
    ...SIMPLE_TOOLS_RESOLVED_PROVIDER_ENTRY_STUB,
    config,
  };

  return context;
};
