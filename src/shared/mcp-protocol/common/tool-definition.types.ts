import type { z } from 'zod';

type ToolAnnotations = Readonly<{
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}>;

type ToolInputSchema = Readonly<Record<string, z.ZodType>>;
type ToolOutputSchema = z.ZodType<Readonly<Record<string, unknown>>>;

export type ToolDefinition = Readonly<{
  name: string;
  description: string;
  inputSchema?: ToolInputSchema;
  outputSchema?: ToolOutputSchema;
  annotations: ToolAnnotations;
}>;
