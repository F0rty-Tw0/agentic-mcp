import { z } from 'zod';

const outputFormatSchema = z.enum(['json', 'stream-json', 'text']);

export const providerAttributionSchema = z.object({
  provider: z.string(),
  model: z.string().optional(),
  executionTimeMs: z.number(),
  outputBytes: z.number(),
  truncated: z.boolean(),
  outputFormat: outputFormatSchema,
  sessionMode: z.string().optional(),
  outputFormatObserved: outputFormatSchema.optional(),
});

export const askToolStructuredContentSchema = z.object({
  response: z.string(),
  attribution: providerAttributionSchema,
  parsed: z.unknown().optional(),
  sessionMode: z.string().optional(),
});

export type AskToolStructuredContent = z.infer<typeof askToolStructuredContentSchema>;
