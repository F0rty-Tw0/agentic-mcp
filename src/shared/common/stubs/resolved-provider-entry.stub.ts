import { TEST_PROVIDER_CONFIG_STUB } from './provider-config.stub.ts';
import type { ResolvedProviderEntry } from '../provider-config.type.ts';

export const TEST_RESOLVED_PROVIDER_ENTRY_STUB: ResolvedProviderEntry = {
  name: 'test',
  binaryPath: '/usr/bin/test-cli',
  config: TEST_PROVIDER_CONFIG_STUB,
};
