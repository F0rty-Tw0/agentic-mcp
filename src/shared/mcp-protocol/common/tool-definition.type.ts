import type { z } from 'zod';

type ToolAnnotations = {
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
  readonly openWorldHint?: boolean;
};

type ToolInputSchema = Readonly<Record<string, z.ZodType>>;

export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: ToolInputSchema;
  readonly annotations: ToolAnnotations;
};
