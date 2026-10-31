import { buildAskInputSchema } from './ask-tool-input.builder';
import { getAskCommand } from '../../ask/utils';
import type { ToolDefinition } from '../../shared/mcp-protocol/common';
import type { ProviderConfig } from '../../shared/provider/common';

export const buildAskToolDefinition = (providerName: string, config: ProviderConfig): ToolDefinition => {
  const askCmd = getAskCommand(config);

  const annotations = { destructiveHint: true, openWorldHint: true };
  const definition: ToolDefinition = {
    name: `ask_${providerName}`,
    description:
      `Get an answer from ${providerName}. Returns the answer as text content and opt-in structured metadata ` +
      `for attribution, session mode, and parsed provider payloads. ` +
      `For work likely to take more than about a minute (a big PR review, a multi-file task), call with ` +
      `mode: "async", then poll with action: "status" and the returned job_id, so your MCP client's own ` +
      `tool-call timeout cannot cut the run off.`,
    inputSchema: buildAskInputSchema(config, askCmd),
    annotations,
  };

  return definition;
};

export const buildSessionsToolDefinition = (providerName: string): ToolDefinition => {
  const annotations = { readOnlyHint: true, idempotentHint: true };
  const definition: ToolDefinition = {
    name: `sessions_${providerName}`,
    description: `List known ask sessions for ${providerName}`,
    inputSchema: {},
    annotations,
  };

  return definition;
};
