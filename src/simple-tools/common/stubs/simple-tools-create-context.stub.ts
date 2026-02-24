import { SIMPLE_TOOLS_PROVIDER_CONFIG_STUB } from './simple-tools-provider-config.stub';
import { SIMPLE_TOOLS_RESOLVED_PROVIDER_ENTRY_STUB } from './simple-tools-resolved-provider-entry.stub';
import type { ProviderConfig, ResolvedProviderEntry } from "../../../shared/common";

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
