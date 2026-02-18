import { z } from 'zod';

import type { OutputFormat, SandboxCapability } from './provider-primitives.type.js';

export const askCommandSchema = z.object({
  prePrompt: z.array(z.string()),
  postPrompt: z.array(z.string()),
  modelFlag: z.string().nullable(),
  outputFlags: z.array(z.string()).optional(),
  autoModeFlags: z.array(z.string()).optional(),
  workingDirFlag: z.string().optional(),
  fileFlag: z.string().nullable().optional(),
});

export const reviewCommandSchema = z.object({
  subcommand: z.string().optional(),
  prePrompt: z.array(z.string()).optional(),
  uncommittedFlag: z.string().optional(),
  baseFlag: z.string().optional(),
  commitFlag: z.string().optional(),
  modelFlag: z.string().optional(),
});

export const sessionsCommandSchema = z.object({
  resumeFlag: z.array(z.string()).optional(),
  continueFlag: z.array(z.string()).optional(),
  listCommand: z.array(z.string()).optional(),
});

export const sandboxCommandSchema = z.object({
  flag: z.string(),
  levels: z.array(z.string()).optional(),
});

export const capabilitiesSchema = z.object({
  ask: z.boolean(),
  review: z.boolean().optional(),
  sessions: z.boolean().optional(),
  sandbox: z.union([z.boolean(), z.literal('leveled')]).optional() as z.ZodType<
    SandboxCapability | undefined
  >,
  autoMode: z.boolean().optional(),
  workingDirectory: z.boolean().optional(),
  fileContext: z.boolean().optional(),
  outputFormat: z.enum(['json', 'stream-json', 'text']).optional() as z.ZodType<
    OutputFormat | undefined
  >,
});

export const commandsSchema = z.object({
  ask: askCommandSchema,
  review: reviewCommandSchema.optional(),
  sessions: sessionsCommandSchema.optional(),
  sandbox: sandboxCommandSchema.optional(),
});

export const inputSchema = z.object({
  method: z.enum(['flag', 'positional', 'stdin']),
});

export const providerConfigSchema = z
  .object({
    enabled: z.boolean(),
    description: z.string(),
    command: z.string(),
    defaultModel: z.string(),
    timeout: z.number().positive(),
    env: z.record(z.string(), z.string().nullable()),
    prerequisites: z.array(z.string()).optional(),
    versionCheck: z
      .object({
        flag: z.string(),
        pattern: z.string().optional(),
      })
      .optional(),
    capabilities: capabilitiesSchema,
    commands: commandsSchema,
    input: inputSchema,
  })
  .refine(
    (data) => {
      if (data.capabilities.review === true && data.commands.review === undefined) {
        return false;
      }

      return true;
    },
    {
      message: 'commands.review must be defined when capabilities.review is true',
      path: ['commands', 'review'],
    },
  )
  .refine(
    (data) => {
      if (data.capabilities.sessions === true && data.commands.sessions === undefined) {
        return false;
      }

      return true;
    },
    {
      message: 'commands.sessions must be defined when capabilities.sessions is true',
      path: ['commands', 'sessions'],
    },
  )
  .refine(
    (data) => {
      if (data.capabilities.sandbox && data.commands.sandbox === undefined) {
        return false;
      }

      return true;
    },
    {
      message: 'commands.sandbox must be defined when capabilities.sandbox is truthy',
      path: ['commands', 'sandbox'],
    },
  );

export const providersFileSchema = z.object({
  $schema: z.string().optional(),
  configVersion: z.literal(1),
  providers: z.record(z.string(), providerConfigSchema),
});
