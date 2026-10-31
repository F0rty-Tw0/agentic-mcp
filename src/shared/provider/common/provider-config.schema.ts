import { z } from 'zod';

import { MAX_TIMER_DELAY_MS } from './provider-timeout.const';
import type { OutputFormat } from '../../mcp-protocol/common';

const PROVIDER_NAME_REGEX = /^[a-z][a-z0-9-]{0,31}$/;
const RESERVED_PROVIDER_NAMES: string[] = ['providers'];
const PROVIDER_NAME_FORMAT_MESSAGE =
  'provider name must be lowercase alphanumeric with hyphens (a-z, 0-9, -), start with a letter, max 32 chars';
const reservedProviderNameIssue = {
  message: `provider name must not be a reserved name: ${RESERVED_PROVIDER_NAMES.join(', ')}`,
};

const providerNameFormatSchema = z.string().regex(PROVIDER_NAME_REGEX, PROVIDER_NAME_FORMAT_MESSAGE);
const providerNameSchema = providerNameFormatSchema.refine(
  (name) => !RESERVED_PROVIDER_NAMES.includes(name),
  reservedProviderNameIssue
);

const leveledFlagSchema = z.object({
  flag: z.string(),
  values: z.array(z.string()).min(1),
});

const flagValueSchema = z.union([z.string(), z.array(z.string()).min(1), leveledFlagSchema, z.null(), z.undefined()]);
const ENV_VAR_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const supportLevelSchema = z.enum(['stable', 'beta', 'experimental', 'community']);
const outputFormatSchema: z.ZodType<OutputFormat> = z.enum(['json', 'stream-json', 'text']);

const streamingCommandSchema = z.object({
  trailingArgs: z.array(z.string()).optional(),
  outputFormat: outputFormatSchema.optional(),
});

const commandDefSchema = z.object({
  args: z.array(z.string()).optional(),
  trailingArgs: z.array(z.string()).optional(),
  flags: z.record(z.string(), flagValueSchema).optional(),
  streaming: streamingCommandSchema.optional(),
  placement: z.enum(['end', 'beforePrompt']).optional(),
});

const commandsSchema = z.record(z.string(), commandDefSchema).refine((commands) => 'ask' in commands, {
  message: 'commands must include an "ask" command definition',
});

const inputSchema = z.object({
  method: z.enum(['flag', 'positional', 'stdin']),
});

const TIMER_DELAY_LIMIT_MESSAGE = `must be at most ${MAX_TIMER_DELAY_MS} ms (Node timer limit)`;
const positiveNumberSchema = z.number().positive();
const timerDelayMsSchema = positiveNumberSchema.max(MAX_TIMER_DELAY_MS, TIMER_DELAY_LIMIT_MESSAGE);

const versionCheckSchema = z.object({
  flag: z.string(),
  pattern: z.string().optional(),
});

const providerConfigSchema = z.object({
  enabled: z.boolean(),
  description: z.string(),
  supportLevel: supportLevelSchema.optional(),
  command: z.string(),
  timeout: timerDelayMsSchema,
  idleTimeout: timerDelayMsSchema.optional(),
  acceptResultOnTimeout: z.boolean().optional(),
  resultExitGraceMs: timerDelayMsSchema.optional(),
  maxConcurrency: z.number().int().positive().optional(),
  queueTimeoutMs: timerDelayMsSchema.optional(),
  env: z.record(z.string(), z.string().nullable()),
  envPassthrough: z.array(z.string().regex(ENV_VAR_NAME_PATTERN)).optional(),
  prerequisites: z.array(z.string()).optional(),
  versionCheck: versionCheckSchema.optional(),
  outputFormat: outputFormatSchema,
  commands: commandsSchema,
  input: inputSchema,
});

export const providersFileSchema = z.object({
  $schema: z.string().optional(),
  configVersion: z.literal(1),
  providers: z.record(providerNameSchema, providerConfigSchema),
});

export type FlagValue = z.infer<typeof flagValueSchema>;

export type SupportLevel = z.infer<typeof supportLevelSchema>;

export type CommandDef = z.infer<typeof commandDefSchema>;

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export type ProvidersFile = z.infer<typeof providersFileSchema>;
