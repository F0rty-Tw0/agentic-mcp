import { z } from 'zod';

const leveledFlagSchema = z.object({
  flag: z.string(),
  values: z.array(z.string()).min(1),
});

export const flagValueSchema = z.union([z.string(), z.array(z.string()).min(1), leveledFlagSchema, z.null()]);

export const commandDefSchema = z.object({
  args: z.array(z.string()).optional(),
  trailingArgs: z.array(z.string()).optional(),
  flags: z.record(z.string(), flagValueSchema).optional(),
});

const commandsSchema = z.record(z.string(), commandDefSchema).refine((commands) => 'ask' in commands, {
  message: 'commands must include an "ask" command definition',
});

const inputSchema = z.object({
  method: z.enum(['flag', 'positional', 'stdin']),
});

const providerConfigSchema = z.object({
  enabled: z.boolean(),
  description: z.string(),
  command: z.string(),
  timeout: z.number().positive(),
  env: z.record(z.string(), z.string().nullable()),
  prerequisites: z.array(z.string()).optional(),
  versionCheck: z
    .object({
      flag: z.string(),
      pattern: z.string().optional(),
    })
    .optional(),
  outputFormat: z.enum(['json', 'stream-json', 'text']),
  commands: commandsSchema,
  input: inputSchema,
});

export const providersFileSchema = z.object({
  $schema: z.string().optional(),
  configVersion: z.literal(1),
  providers: z.record(z.string(), providerConfigSchema),
});

export type FlagValue = z.infer<typeof flagValueSchema>;

export type CommandDef = z.infer<typeof commandDefSchema>;

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export type ProvidersFile = z.infer<typeof providersFileSchema>;
