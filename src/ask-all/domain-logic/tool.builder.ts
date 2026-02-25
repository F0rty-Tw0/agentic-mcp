import { z } from 'zod';

import type { ToolDefinition } from '../../shared/common';
import { ASK_ALL_TOOL_NAME } from '../common';

export const buildAskAllToolDefinition = (providerNames: readonly string[]): ToolDefinition => {
  const providerList = providerNames.length > 0 ? providerNames.join(', ') : 'none configured';

  const inputSchema: Record<string, z.ZodType> = {
    prompt: z.string().describe('The prompt or question to send to all providers simultaneously'),
    providers: z
      .array(z.string())
      .optional()
      .describe(`Filter to specific providers. Available: ${providerList}. If omitted, all providers are queried.`),
    model: z.string().optional().describe('Model to use for this request on each provider that supports it'),
    context: z.string().optional().describe('Optional user-supplied context to prepend before the current prompt'),
    working_directory: z
      .string()
      .optional()
      .describe('Working directory path — the agent will have access to files in this directory'),
    system_prompt: z
      .string()
      .optional()
      .describe('Custom system prompt prepended to the conversation for each provider'),
  };

  const definition: ToolDefinition = {
    name: ASK_ALL_TOOL_NAME,
    description:
      `Send a prompt to all configured providers simultaneously and collect their responses. ` +
      `Available providers: ${providerList}. ` +
      `Returns a structured result with each provider's response, success status, and timing.`,
    inputSchema,
    annotations: { destructiveHint: true, openWorldHint: true },
  };

  return definition;
};
