import type { CallToolResult, McpServer, ServerContext } from '@modelcontextprotocol/server';

import { buildAskToolDefinition, buildSessionsToolDefinition } from './ask-tool.builder';
import { buildReviewToolDefinition } from './review-tool.builder';
import { handleAsk, handleReview } from '../../ask';
import type { AskToolArgs } from '../../ask/common';
import { buildAskAllToolDefinition, handleAskAll } from '../../ask-all';
import { buildProviderMetricsToolDefinition, handleProviderMetrics } from '../../provider-metrics';
import { handleSessions } from '../../session';
import type { ResolvedProvider, ResolvedProviderEntry } from '../../shared/provider/common';
import { ValidationError } from '../../shared/validation/common';
import {
  buildHelpToolDefinition,
  buildListProvidersDefinition,
  buildPingToolDefinition,
  handleHelp,
  handleListProviders,
  handlePing,
} from '../../simple-tools';
import { toInputSchema } from '../utils/input-schema.util';
import { toProgressContext } from '../utils/progress-context.util';
import { isAskAllToolArgs, isReviewToolArgs } from '../utils/tool-args.util';

const registerAskTool = (server: McpServer, provider: ResolvedProviderEntry): void => {
  const { name, config } = provider;
  const askDef = buildAskToolDefinition(name, config);
  const askConfig = {
    description: askDef.description,
    inputSchema: toInputSchema(askDef.inputSchema),
    annotations: askDef.annotations,
  };

  server.registerTool(
    askDef.name,
    askConfig,
    async (args: AskToolArgs, ctx: ServerContext): Promise<CallToolResult> => {
      const progressContext = toProgressContext(ctx);

      return handleAsk(provider, args, progressContext);
    }
  );
};

const registerProviderTools = (server: McpServer, provider: ResolvedProviderEntry): void => {
  const { name, config } = provider;

  registerAskTool(server, provider);

  if (config.commands.review) {
    const reviewDef = buildReviewToolDefinition(name, config);
    const reviewConfig = {
      description: reviewDef.description,
      inputSchema: toInputSchema(reviewDef.inputSchema),
      annotations: reviewDef.annotations,
    };

    server.registerTool(reviewDef.name, reviewConfig, async (args, ctx): Promise<CallToolResult> => {
      if (!isReviewToolArgs(args)) throw new ValidationError(`${reviewDef.name} requires a review scope`);

      const progressContext = toProgressContext(ctx);

      return handleReview(provider, args, progressContext);
    });
  }

  if (config.commands.sessions) {
    const sessionsDef = buildSessionsToolDefinition(name);
    const sessionsConfig = {
      description: sessionsDef.description,
      annotations: sessionsDef.annotations,
      inputSchema: toInputSchema(sessionsDef.inputSchema),
    };

    server.registerTool(sessionsDef.name, sessionsConfig, (): CallToolResult => handleSessions(name));
  }

  const pingDef = buildPingToolDefinition(name);
  const pingConfig = {
    description: pingDef.description,
    annotations: pingDef.annotations,
  };

  server.registerTool(pingDef.name, pingConfig, async (ctx: ServerContext): Promise<CallToolResult> => {
    const signal = ctx.mcpReq.signal;

    return handlePing(provider, signal);
  });

  const helpDef = buildHelpToolDefinition(name);
  const helpConfig = {
    description: helpDef.description,
    annotations: helpDef.annotations,
  };

  server.registerTool(helpDef.name, helpConfig, async (ctx: ServerContext): Promise<CallToolResult> => {
    const signal = ctx.mcpReq.signal;

    return handleHelp(provider, signal);
  });
};

export const registerAllTools = (
  server: McpServer,
  resolvedProviders: ResolvedProviderEntry[],
  allProviders: ResolvedProvider[]
): void => {
  for (const provider of resolvedProviders) {
    registerProviderTools(server, provider);
  }

  // Register global ask_all tool
  const askAllDef = buildAskAllToolDefinition(resolvedProviders.map((provider) => provider.name));
  const askAllConfig = {
    description: askAllDef.description,
    inputSchema: toInputSchema(askAllDef.inputSchema),
    annotations: askAllDef.annotations,
  };

  server.registerTool(askAllDef.name, askAllConfig, async (args, ctx): Promise<CallToolResult> => {
    if (!isAskAllToolArgs(args)) throw new ValidationError(`${askAllDef.name} requires a prompt`);

    const progressContext = toProgressContext(ctx);

    return handleAskAll(resolvedProviders, args, progressContext);
  });

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
