import type { z } from 'zod';

import type {
  commandDefSchema,
  flagValueSchema,
  providerConfigSchema,
  providersFileSchema,
} from './provider-config.schema.ts';

export type FlagValue = z.infer<typeof flagValueSchema>;

export type CommandDef = z.infer<typeof commandDefSchema>;

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export type ProvidersFile = z.infer<typeof providersFileSchema>;

export type ResolvedProviderEntry = {
  name: string;
  binaryPath: string;
  config: ProviderConfig;
};
