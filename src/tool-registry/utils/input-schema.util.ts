import { z } from 'zod';

import type { ToolDefinition } from '../../shared/mcp-protocol/common';

type ToolInputShape = NonNullable<ToolDefinition['inputSchema']>;

export const toInputSchema = (shape: ToolInputShape = {}): z.ZodObject<ToolInputShape> => {
  const inputSchema = z.object(shape);

  return inputSchema;
};
