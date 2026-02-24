import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { SESSION_STORE } from '../../../session/session-store.ts';

export const handleSessions = (providerName: string): CallToolResult => {
  const sessions = SESSION_STORE.listByProvider(providerName);
  const lines = sessions.map((session) => {
    const native = session.nativeSessionId ? ` native=${session.nativeSessionId}` : '';

    return `- ${session.id}${native} turns=${session.turns.length}`;
  });

  return {
    content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n') : '(no sessions)' }],
  };
};
