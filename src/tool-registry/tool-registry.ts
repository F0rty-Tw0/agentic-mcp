import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { AskToolArgs } from "../ask/common";
import { handleAsk } from '../ask/domain-logic/ask.handler';
import { handleSessions } from '../ask/domain-logic/sessions.handler';
import { buildAskToolDefinition, buildSessionsToolDefinition } from '../ask/domain-logic/tool.builder';
import type { AskAllToolArgs } from "../ask-all/common";
import { handleAskAll } from '../ask-all/domain-logic/ask-all.handler';
import { buildAskAllToolDefinition } from '../ask-all/domain-logic/tool.builder';
import type { ProgressContext, ResolvedProvider, ResolvedProviderEntry } from "../shared/common";
import { handleHelp } from '../simple-tools/domain-logic/help.handler';
import { handleListProviders } from '../simple-tools/domain-logic/meta.handler';
import { handlePing } from '../simple-tools/domain-logic/ping.handler';
import {
  buildHelpToolDefinition,
  buildListProvidersDefinition,
  buildPingToolDefinition,
} from '../simple-tools/domain-logic/tool.builder';
import { buildUsageSummaryToolDefinition } from '../usage-stats/domain-logic/tool.builder';
import { handleUsageSummary } from '../usage-stats/domain-logic/usage-stats.handler';

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

  if (config.commands.sessions) {
    const sessionsDef = buildSessionsToolDefinition(name);
    const sessionsConfig = {
      description: sessionsDef.description,
      annotations: sessionsDef.annotations,
      inputSchema: sessionsDef.inputSchema,
    };

    server.registerTool(sessionsDef.name, sessionsConfig, (): CallToolResult => handleSessions(name));
  }

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

  // Register global ask_all tool
  const askAllDef = buildAskAllToolDefinition(resolvedProviders.map((provider) => provider.name));
  const askAllConfig = {
    description: askAllDef.description,
    inputSchema: askAllDef.inputSchema,
    annotations: askAllDef.annotations,
  };

  server.registerTool(
    askAllDef.name,
    askAllConfig,
    async (args): Promise<CallToolResult> => handleAskAll(resolvedProviders, args as AskAllToolArgs)
  );

  // Always register the usage_summary tool
  const usageDef = buildUsageSummaryToolDefinition();
  const usageConfig = { description: usageDef.description, annotations: usageDef.annotations };

  server.registerTool(usageDef.name, usageConfig, (): CallToolResult => handleUsageSummary());

  // Always register the meta tool
  const listDef = buildListProvidersDefinition();

  const config = {
    description: listDef.description,
    annotations: listDef.annotations,
  };

  server.registerTool(listDef.name, config, (): CallToolResult => handleListProviders(allProviders));
};
