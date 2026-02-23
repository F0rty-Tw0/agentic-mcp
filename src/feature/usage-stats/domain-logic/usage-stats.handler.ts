import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { getUsageSummary } from '../data-access/usage-stats-store.ts';

export const handleUsageSummary = (): CallToolResult => {
  const summary = getUsageSummary();

  return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
};
