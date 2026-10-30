import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/provider/common';
import {
  SIMPLE_TOOLS_PROVIDER_CONFIG_STUB,
  SIMPLE_TOOLS_RESOLVED_PROVIDER_ENTRY_STUB,
} from '../stubs/simple-tools.stub';

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
