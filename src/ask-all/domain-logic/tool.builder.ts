import { z } from 'zod';

import type { ToolDefinition } from '../../shared';
import { ASK_ALL_TOOL_NAME } from '../common';

type AskAllInputSchema = Readonly<Record<string, z.ZodType>>;

export const buildAskAllToolDefinition = (providerNames: readonly string[]): ToolDefinition => {
  const providerList = providerNames.length > 0 ? providerNames.join(', ') : 'none configured';

  const inputSchema: AskAllInputSchema = {
    prompt: z.string().describe('The prompt or question to send to all providers simultaneously'),
    providers: z
      .array(z.string())
      .optional()
      .describe(
        `Explicit provider selection. Available: ${providerList}. CLI aliases --provider/--providers both map here, and multi-values may be comma-separated or space-separated.`
      ),
    model: z
      .string()
      .optional()
      .describe(
        'Single shared model to use on each selected provider. CLI aliases --model/--models both map here. Use --providers for provider selection. If a selected provider rejects the shared model as unavailable or unsupported, ask_all returns that provider error instead of falling back to a different model.'
      ),
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
      `Compare multiple providers on the same prompt through one command. ` +
      `Available providers: ${providerList}. ` +
      `Returns a structured result with each provider's response, success status, and timing.`,
    inputSchema,
    annotations: { destructiveHint: true, openWorldHint: true },
  };

  return definition;
};
