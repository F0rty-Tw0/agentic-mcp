import { SIMPLE_TOOLS_PROVIDER_CONFIG_STUB } from './simple-tools-provider-config.stub';
import type { ResolvedProviderEntry } from "../../../shared/common";

export const SIMPLE_TOOLS_RESOLVED_PROVIDER_ENTRY_STUB: ResolvedProviderEntry = {
  name: 'test',
  binaryPath: '/usr/bin/test-cli',
  config: SIMPLE_TOOLS_PROVIDER_CONFIG_STUB,
};
