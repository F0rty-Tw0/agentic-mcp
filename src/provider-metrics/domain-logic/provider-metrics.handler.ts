import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { toMcpError } from '../../shared';
import type { ToolDefinition } from '../../shared';
import { getProviderMetrics } from '../data-access/provider-metrics-store';

export const handleProviderMetrics = async (): Promise<CallToolResult> => {
  try {
    const summary = await getProviderMetrics();
    const text = JSON.stringify(summary, null, 2);
    const callToolResult: CallToolResult = {
      content: [{ type: 'text', text }],
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
    description: 'See how many times each AI provider was called overall, with response times and success rates',
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return toolDefinition;
};
