import type { ProviderConfig, SupportLevel } from './provider-config.schema';

export type ProviderEnv = Record<string, string | null>;

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
  binaryPath?: string;
  supportLevel?: SupportLevel;
  prerequisites?: readonly string[];
}>;
