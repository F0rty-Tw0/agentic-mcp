import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ToolDefinition } from '../../shared/common';
import { getProviderMetrics } from '../data-access/provider-metrics-store';

export const handleProviderMetrics = (): CallToolResult => {
  const summary = getProviderMetrics();
  const text = JSON.stringify(summary, null, 2);

  const callToolResult: CallToolResult = {
    content: [{ type: 'text', text }],
  };

  return callToolResult;
};

export const buildProviderMetricsToolDefinition = (): ToolDefinition => {
  const toolDefinition: ToolDefinition = {
    name: 'provider_metrics',
    description: 'See how many times each AI provider was called this session, with response times and success rates',
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return toolDefinition;
};
