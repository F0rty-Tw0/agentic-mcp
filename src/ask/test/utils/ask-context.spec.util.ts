import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/provider/common';
import { ASK_PROVIDER_CONFIG_STUB } from '../stubs/ask-provider-config.stub';
import { ASK_RESOLVED_PROVIDER_ENTRY_STUB } from '../stubs/ask-resolved-provider-entry.stub';

export const createAskContext = (overrides: Partial<ProviderConfig> = {}): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    ...ASK_PROVIDER_CONFIG_STUB,
    ...overrides,
  };

  const context: ResolvedProviderEntry = {
    ...ASK_RESOLVED_PROVIDER_ENTRY_STUB,
    config,
  };

  return context;
};
