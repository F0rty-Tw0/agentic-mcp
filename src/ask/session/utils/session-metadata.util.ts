import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { SessionMode } from '../../common';

export const appendSessionMetadata = (response: CallToolResult, sessionMode: SessionMode): CallToolResult => {
  if (sessionMode === 'none') return response;

  return {
    ...response,
    content: [...response.content, { type: 'text', text: JSON.stringify({ sessionMode }, null, 2) }],
  };
};
