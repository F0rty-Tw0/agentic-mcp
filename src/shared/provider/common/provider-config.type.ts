import type { ProviderConfig, SupportLevel } from './provider-config.schema';

export type ProviderEnv = Record<string, string | null>;

export type ResolvedProviderEntry = {
  readonly name: string;
  readonly binaryPath: string;
  readonly config: ProviderConfig;
};

export type ResolvedProvider = {
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly available: boolean;
  readonly binaryPath?: string;
  readonly supportLevel?: SupportLevel;
  readonly prerequisites?: string[];
};
