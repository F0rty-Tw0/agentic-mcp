import type { z } from 'zod';

import type {
  commandDefSchema,
  commandsSchema,
  flagValueSchema,
  inputSchema,
  leveledFlagSchema,
  providerConfigSchema,
  providersFileSchema,
} from './provider-config.schema.ts';

export type LeveledFlag = z.infer<typeof leveledFlagSchema>;

export type FlagValue = z.infer<typeof flagValueSchema>;

export type CommandDef = z.infer<typeof commandDefSchema>;

export type Commands = z.infer<typeof commandsSchema>;

export type Input = z.infer<typeof inputSchema>;

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export type ProvidersFile = z.infer<typeof providersFileSchema>;
