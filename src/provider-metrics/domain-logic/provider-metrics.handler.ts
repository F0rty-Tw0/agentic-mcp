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
    description: 'See which providers you actually used, how often they succeeded, and how long they took',
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return toolDefinition;
};
