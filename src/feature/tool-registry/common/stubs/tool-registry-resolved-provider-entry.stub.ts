import { TOOL_REGISTRY_PROVIDER_CONFIG_STUB } from './tool-registry-provider-config.stub.ts';
import type { ResolvedProviderEntry } from '../../../../shared/common/index.ts';

export const TOOL_REGISTRY_RESOLVED_PROVIDER_ENTRY_STUB: ResolvedProviderEntry = {
  name: 'claude',
  binaryPath: '/usr/bin/claude',
  config: TOOL_REGISTRY_PROVIDER_CONFIG_STUB,
};
