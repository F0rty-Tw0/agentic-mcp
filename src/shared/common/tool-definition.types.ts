import type { z } from 'zod';

type ToolAnnotations = Readonly<{
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}>;

export type ToolDefinition = Readonly<{
  name: string;
  description: string;
  inputSchema: Readonly<Record<string, z.ZodType>>;
  annotations: ToolAnnotations;
}>;
