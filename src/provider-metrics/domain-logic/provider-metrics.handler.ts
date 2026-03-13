import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { toMcpError } from '../../shared';
import type { ToolDefinition } from '../../shared';
import type { ProviderMetricsSummary, ProviderStats } from '../common';
import { getProviderMetrics } from '../data-access/provider-metrics-store';

const buildSuccessRate = (providerStats: ProviderStats): number => {
  const successRate = Math.round((providerStats.successCount / providerStats.totalCalls) * 100);

  return successRate;
};

const buildProviderSummaryLine = (providerStats: ProviderStats): string => {
  const successRate = buildSuccessRate(providerStats);
  const line =
    `- ${providerStats.provider}: ${providerStats.totalCalls} calls, ${providerStats.successCount} succeeded, ` +
    `${providerStats.failureCount} failed, success ${successRate}%, avg ${providerStats.avgExecutionTimeMs}ms, ` +
    `last ${providerStats.lastCallAt}`;

  return line;
};

const buildNextStepLine = (summary: ProviderMetricsSummary): string => {
  if (summary.totalCalls === 0) {
    return 'Next: run prove or ask_<provider> to start collecting provider metrics.';
  }

  return 'Next: run ask_all --report <path> when you want a saved comparison artifact.';
};

const buildProviderMetricsSummaryText = (summary: ProviderMetricsSummary): string => {
  const providerLines =
    summary.providers.length === 0
      ? ['- none yet']
      : summary.providers.map((provider) => buildProviderSummaryLine(provider));
  const lines = [
    `Provider usage since ${summary.collectedSince}`,
    `Metrics file: ${summary.metricsFilePath}`,
    `Total calls: ${summary.totalCalls}`,
    'Providers:',
    ...providerLines,
    buildNextStepLine(summary),
  ];
  const text = lines.join('\n');

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
