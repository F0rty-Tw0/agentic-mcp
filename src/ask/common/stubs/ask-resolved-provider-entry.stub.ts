import { ASK_PROVIDER_CONFIG_STUB } from './ask-provider-config.stub.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/index.ts';

export const ASK_RESOLVED_PROVIDER_ENTRY_STUB: ResolvedProviderEntry = {
  name: 'test',
  binaryPath: '/usr/bin/test-cli',
  config: ASK_PROVIDER_CONFIG_STUB,
};
