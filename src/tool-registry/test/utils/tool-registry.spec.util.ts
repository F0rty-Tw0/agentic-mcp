import type { ProviderConfig, ResolvedProvider, ResolvedProviderEntry } from '../../../shared/provider/common';
import {
  TOOL_REGISTRY_PROVIDER_CONFIG_STUB,
  TOOL_REGISTRY_RESOLVED_PROVIDER_ENTRY_STUB,
  TOOL_REGISTRY_RESOLVED_PROVIDER_STUB,
} from '../stubs/tool-registry.stub';

export const makeConfig = (): ProviderConfig => {
  const providerConfig: ProviderConfig = { ...TOOL_REGISTRY_PROVIDER_CONFIG_STUB };

  return providerConfig;
};

export const makeProvider = (name = 'claude'): ResolvedProviderEntry => {
  const config = makeConfig();
  const resolvedProviderEntry: ResolvedProviderEntry = {
    ...TOOL_REGISTRY_RESOLVED_PROVIDER_ENTRY_STUB,
    name,
    binaryPath: `/usr/bin/${name}`,
    config,
  };

  return resolvedProviderEntry;
};

export const makeResolvedProvider = (name = 'claude'): ResolvedProvider => {
  const resolvedProvider: ResolvedProvider = {
    ...TOOL_REGISTRY_RESOLVED_PROVIDER_STUB,
    name,
    description: `${name} provider`,
    binaryPath: `/usr/bin/${name}`,
  };

  return resolvedProvider;
};
