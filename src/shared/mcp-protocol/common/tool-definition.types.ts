import type { z } from 'zod';

type ToolAnnotations = Readonly<{
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}>;

type ToolInputSchema = Readonly<Record<string, z.ZodType>>;

export type ToolDefinition = Readonly<{
  name: string;
  description: string;
  inputSchema?: ToolInputSchema;
  annotations: ToolAnnotations;
}>;
