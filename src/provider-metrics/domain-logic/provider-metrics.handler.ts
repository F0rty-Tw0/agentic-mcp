import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { toMcpError } from '../../shared';
import type { ToolDefinition } from '../../shared';
import { getProviderMetrics } from '../data-access/provider-metrics-store';

const buildProviderSummaryLine = (
  providerStats: Awaited<ReturnType<typeof getProviderMetrics>>['providers'][number]
): string =>
  `- ${providerStats.provider}: ${providerStats.totalCalls} calls, ${providerStats.successCount} succeeded, ` +
  `${providerStats.failureCount} failed, avg ${providerStats.avgExecutionTimeMs}ms, last ${providerStats.lastCallAt}`;

const buildProviderMetricsSummaryText = (summary: Awaited<ReturnType<typeof getProviderMetrics>>): string => {
  const headerLines = [`Provider usage since ${summary.collectedSince}`, `Total calls: ${summary.totalCalls}`];

  if (summary.providers.length === 0) {
    const emptyText = [...headerLines, 'Providers:', '- none yet'].join('\n');

    return emptyText;
  }

  const text = [
    ...headerLines,
    'Providers:',
    ...summary.providers.map((provider) => buildProviderSummaryLine(provider)),
  ].join('\n');

  return text;
};

export const handleProviderMetrics = async (): Promise<CallToolResult> => {
  try {
    const summary = await getProviderMetrics();
    const text = buildProviderMetricsSummaryText(summary);
    const callToolResult: CallToolResult = {
      content: [{ type: 'text', text }],
      structuredContent: summary,
    };

    return callToolResult;
  } catch (error: unknown) {
    const mcpError = toMcpError(error);

    return mcpError;
  }
};

export const buildProviderMetricsToolDefinition = (): ToolDefinition => {
  const toolDefinition: ToolDefinition = {
    name: 'provider_metrics',
    description: 'See which providers you actually used, how often they succeeded, and how long they took',
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return toolDefinition;
};
