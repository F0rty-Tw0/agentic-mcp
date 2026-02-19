import type { ProviderConfig } from './provider-config.schema.ts';

export type ResolvedProviderEntry = Readonly<{
  name: string;
  binaryPath: string;
  config: ProviderConfig;
}>;
