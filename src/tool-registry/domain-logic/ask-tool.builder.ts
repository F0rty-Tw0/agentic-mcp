import { buildAskInputSchema } from './ask-tool-input.builder';
import { getAskCommand } from '../../ask/utils';
import type { ProviderConfig, ToolDefinition } from '../../shared';

export const buildAskToolDefinition = (providerName: string, config: ProviderConfig): ToolDefinition => {
  const askCmd = getAskCommand(config);

  const definition: ToolDefinition = {
    name: `ask_${providerName}`,
    description:
      `Get an answer from ${providerName}. Returns the answer as text content and opt-in structured metadata ` +
      `for attribution, session mode, and parsed provider payloads.`,
    inputSchema: buildAskInputSchema(config, askCmd),
    annotations: { destructiveHint: true, openWorldHint: true },
  };

  return definition;
};

export const buildSessionsToolDefinition = (providerName: string): ToolDefinition => {
  const definition: ToolDefinition = {
    name: `sessions_${providerName}`,
    description: `List known ask sessions for ${providerName}`,
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return definition;
};
