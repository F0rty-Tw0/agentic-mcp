import { z } from 'zod';

import type { ToolDefinition } from '../../shared/mcp-protocol/common';
import { ASK_ALL_TOOL_NAME } from '../common';

type AskAllInputSchema = Readonly<Record<string, z.ZodType>>;

export const buildAskAllToolDefinition = (providerNames: string[]): ToolDefinition => {
  const joinedProviderNames = providerNames.join(', ');
  const providerList = providerNames.length > 0 ? joinedProviderNames : 'none configured';

  const prompt = z.string().describe('The prompt or question to send to all providers simultaneously');
  const optionalProviders = z.array(z.string()).optional();
  const providers = optionalProviders.describe(
    `Explicit provider selection. Available: ${providerList}. CLI aliases --provider/--providers both map here, and multi-values may be comma-separated or space-separated.`
  );
  const optionalModel = z.string().optional();
  const model = optionalModel.describe(
    'Single shared model to use on each selected provider. CLI aliases --model/--models both map here. Use --providers for provider selection. If a selected provider rejects the shared model as unavailable or unsupported, ask_all returns that provider error instead of falling back to a different model.'
  );
  const context = z.string().optional().describe('Optional user-supplied context to prepend before the current prompt');
  const optionalWorkingDirectory = z.string().optional();
  const workingDirectory = optionalWorkingDirectory.describe(
    'Working directory path — the agent will have access to files in this directory'
  );
  const optionalSystemPrompt = z.string().optional();
  const systemPrompt = optionalSystemPrompt.describe(
    'Custom system prompt prepended to the conversation for each provider'
  );
  const inputSchema: AskAllInputSchema = {
    prompt,
    providers,
    model,
    context,
    working_directory: workingDirectory,
    system_prompt: systemPrompt,
  };

  const annotations = { destructiveHint: true, openWorldHint: true };
  const definition: ToolDefinition = {
    name: ASK_ALL_TOOL_NAME,
    description:
      `Compare multiple providers on the same prompt through one command. ` +
      `Available providers: ${providerList}. ` +
      `Returns a structured result with each provider's response, success status, and timing. ` +
      `Runs synchronously and waits for the slowest provider; for work likely to take more than about a minute, ` +
      `call ask_<provider> with mode: "async" for each provider instead, then poll each job with action: "status".`,
    inputSchema,
    annotations,
  };

  return definition;
};
