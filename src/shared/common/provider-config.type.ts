import type { ProviderConfig } from './provider-config.schema.ts';

export type ResolvedProviderEntry = Readonly<{
  name: string;
  binaryPath: string;
  config: ProviderConfig;
}>;

export type ResolvedProvider = Readonly<{
  name: string;
  description: string;
  enabled: boolean;
  available: boolean;
  binaryPath: string | null;
}>;
