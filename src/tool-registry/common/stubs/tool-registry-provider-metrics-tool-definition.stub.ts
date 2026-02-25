import type { ToolDefinition } from '../../../shared/common';

export const TOOL_REGISTRY_PROVIDER_METRICS_TOOL_DEFINITION_STUB: ToolDefinition = {
  name: 'provider_metrics',
  description: 'See how many times each AI provider was called this session, with response times and success rates',
  annotations: { readOnlyHint: true, idempotentHint: true },
};
