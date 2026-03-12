import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildAskToolDefinition, buildSessionsToolDefinition } from './ask-tool.builder';
import { buildReviewToolDefinition } from './review-tool.builder';
import { handleAsk, handleReview } from '../../ask';
import type { AskToolArgs, ReviewToolArgs } from '../../ask';
import { buildAskAllToolDefinition, handleAskAll } from '../../ask-all';
import type { AskAllToolArgs } from '../../ask-all';
import { buildProviderMetricsToolDefinition, handleProviderMetrics } from '../../provider-metrics';
import { handleSessions } from '../../session';
import type { ProgressContext, ResolvedProvider, ResolvedProviderEntry } from '../../shared';
import {
  buildHelpToolDefinition,
  buildListProvidersDefinition,
  buildPingToolDefinition,
  handleHelp,
  handleListProviders,
  handlePing,
} from '../../simple-tools';

const registerProviderTools = (server: McpServer, provider: ResolvedProviderEntry): void => {
  const { name, config } = provider;

  const askDef = buildAskToolDefinition(name, config);
  const askConfig = {
    description: askDef.description,
    inputSchema: askDef.inputSchema,
    annotations: askDef.annotations,
  };

  server.registerTool(
    askDef.name,
    askConfig,
    async (args: AskToolArgs, extra: ProgressContext): Promise<CallToolResult> => handleAsk(provider, args, extra)
  );

  if (config.commands.review) {
    const reviewDef = buildReviewToolDefinition(name, config);
    const reviewConfig = {
      description: reviewDef.description,
      inputSchema: reviewDef.inputSchema,
      annotations: reviewDef.annotations,
    };

    server.registerTool(
      reviewDef.name,
      reviewConfig,
      async (args, extra): Promise<CallToolResult> => handleReview(provider, args as ReviewToolArgs, extra)
    );
  }

  if (config.commands.sessions) {
    const sessionsDef = buildSessionsToolDefinition(name);
    const sessionsConfig = {
      description: sessionsDef.description,
      annotations: sessionsDef.annotations,
      inputSchema: sessionsDef.inputSchema,
    };

    server.registerTool(sessionsDef.name, sessionsConfig, (): CallToolResult => handleSessions(name));
  }

  const pingDef = buildPingToolDefinition(name);
  const pingConfig = {
    description: pingDef.description,
    annotations: pingDef.annotations,
  };

  server.registerTool(pingDef.name, pingConfig, async (): Promise<CallToolResult> => handlePing(provider));

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

  const metricsDef = buildProviderMetricsToolDefinition();
  const metricsConfig = { description: metricsDef.description, annotations: metricsDef.annotations };

  server.registerTool(metricsDef.name, metricsConfig, async (): Promise<CallToolResult> => handleProviderMetrics());
  // Always register the meta tool
  const listDef = buildListProvidersDefinition();

  const config = {
    description: listDef.description,
    annotations: listDef.annotations,
  };

  server.registerTool(listDef.name, config, (): CallToolResult => handleListProviders(allProviders));
};
