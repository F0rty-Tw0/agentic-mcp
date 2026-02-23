import type { ToolDefinition } from '../../../shared/common/index.ts';

export const buildUsageSummaryToolDefinition = (): ToolDefinition => ({
  name: 'usage_summary',
  description:
    'See how many times each AI provider was called this session, with response times and success rates',
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true },
});
