import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { SESSION_STORE } from '../data-access';

export const handleSessions = (providerName: string): CallToolResult => {
  const sessions = SESSION_STORE.listByProvider(providerName);
  const lines = sessions.map((session) => {
    const native = session.nativeSessionId ? ` native=${session.nativeSessionId}` : '';
    const line = `- ${session.id}${native} turns=${session.turns.length}`;

    return line;
  });
  const text = lines.length > 0 ? lines.join('\n') : '(no sessions)';
  const callToolResult: CallToolResult = {
    content: [{ type: 'text', text }],
  };

  return callToolResult;
};
