import { ASK_PROVIDER_CONFIG_STUB } from './ask-provider-config.stub';
import { ASK_RESOLVED_PROVIDER_ENTRY_STUB } from './ask-resolved-provider-entry.stub';
import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/common';

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
