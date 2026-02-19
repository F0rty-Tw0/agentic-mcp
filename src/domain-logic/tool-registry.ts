import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProviderEntry } from '../common/provider-config.type.ts';
import type { AskToolArgs } from '../common/tool-args.types.ts';
import { handleAsk } from './handlers/ask.ts';
import { handleHelp } from './handlers/help.ts';
import { handleListProviders } from './handlers/meta.ts';
import type { ResolvedProvider } from './handlers/meta.ts';
import { handlePing } from './handlers/ping.ts';
import {
  buildAskToolDefinition,
  buildHelpToolDefinition,
  buildListProvidersDefinition,
  buildPingToolDefinition,
} from './tool-builder.ts';

const registerProviderTools = (server: McpServer, provider: ResolvedProviderEntry): void => {
  const { name, binaryPath, config } = provider;

  // ask_<provider>
  const askDef = buildAskToolDefinition(name, config);

  server.registerTool(
    askDef.name,
    {
      description: askDef.description,
      inputSchema: askDef.inputSchema,
      annotations: askDef.annotations,
    },
    async (args: Record<string, unknown>): Promise<CallToolResult> =>
      handleAsk({ binaryPath, config, name }, args as AskToolArgs),
  );

  // ping_<provider>
  const pingDef = buildPingToolDefinition(name);

  server.registerTool(
    pingDef.name,
    {
      description: pingDef.description,
      annotations: pingDef.annotations,
    },
    async (): Promise<CallToolResult> => handlePing({ binaryPath, config, name }),
  );

  // help_<provider>
  const helpDef = buildHelpToolDefinition(name);

  server.registerTool(
    helpDef.name,
    {
      description: helpDef.description,
      annotations: helpDef.annotations,
    },
    async (): Promise<CallToolResult> => handleHelp({ binaryPath, config, name }),
  );
};

export const registerAllTools = (
  server: McpServer,
  resolvedProviders: ResolvedProviderEntry[],
  allProviders: ResolvedProvider[],
): void => {
  for (const provider of resolvedProviders) {
    registerProviderTools(server, provider);
  }

  // Always register the meta tool
  const listDef = buildListProvidersDefinition();

  server.registerTool(
    listDef.name,
    {
      description: listDef.description,
      annotations: listDef.annotations,
    },
    (): CallToolResult => handleListProviders(allProviders),
  );
};
