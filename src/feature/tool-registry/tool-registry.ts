import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProvider, ResolvedProviderEntry } from '../../shared/common/index.ts';
import type { AskToolArgs, ProgressContext } from '../ask/common/index.ts';
import { handleAsk } from '../ask/domain-logic/ask.handler.ts';
import { buildAskToolDefinition } from '../ask/domain-logic/tool.builder.ts';
import { handleHelp } from '../simple-tools/domain-logic/help.handler.ts';
import { handleListProviders } from '../simple-tools/domain-logic/meta.handler.ts';
import { handlePing } from '../simple-tools/domain-logic/ping.handler.ts';
import {
  buildHelpToolDefinition,
  buildListProvidersDefinition,
  buildPingToolDefinition,
} from '../simple-tools/domain-logic/tool.builder.ts';

const registerProviderTools = (server: McpServer, provider: ResolvedProviderEntry): void => {
  const { name, config } = provider;

  // ask_<provider>
  const askDef = buildAskToolDefinition(name, config);
  const askCOnfig = {
    description: askDef.description,
    inputSchema: askDef.inputSchema,
    annotations: askDef.annotations,
  };

  server.registerTool(
    askDef.name,
    askCOnfig,
    async (args: AskToolArgs, extra: ProgressContext): Promise<CallToolResult> => handleAsk(provider, args, extra)
  );

  // ping_<provider>
  const pingDef = buildPingToolDefinition(name);
  const pingConfig = {
    description: pingDef.description,
    annotations: pingDef.annotations,
  };

  server.registerTool(pingDef.name, pingConfig, async (): Promise<CallToolResult> => handlePing(provider));

  // help_<provider>
  const helpDef = buildHelpToolDefinition(name);
  const helpConfig = {
    description: helpDef.description,
    annotations: helpDef.annotations,
  };

  server.registerTool(helpDef.name, helpConfig, async (): Promise<CallToolResult> => handleHelp(provider));
};

export const registerAllTools = (
  server: McpServer,
  resolvedProviders: readonly ResolvedProviderEntry[],
  allProviders: readonly ResolvedProvider[]
): void => {
  for (const provider of resolvedProviders) {
    registerProviderTools(server, provider);
  }

  // Always register the meta tool
  const listDef = buildListProvidersDefinition();

  const config = {
    description: listDef.description,
    annotations: listDef.annotations,
  };

  server.registerTool(listDef.name, config, (): CallToolResult => handleListProviders(allProviders));
};
