import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { SessionRecord } from '../common';
import { SESSION_STORE } from '../data-access';

const MAX_PREVIEW_LENGTH = 60;

const buildLastTurnPreview = (session: SessionRecord): string => {
  const lastTurn = session.turns.at(-1);

  if (lastTurn == null) {
    return 'last_turn="(none)"';
  }

  const normalizedText = lastTurn.text.replace(/\s+/g, ' ').trim().replaceAll('"', "'");
  const previewText =
    normalizedText.length <= MAX_PREVIEW_LENGTH
      ? normalizedText
      : `${normalizedText.slice(0, MAX_PREVIEW_LENGTH - 3)}...`;
  const preview = `last_turn="${lastTurn.role}: ${previewText}"`;

  return preview;
};

const buildSessionLine = (session: SessionRecord): string => {
  const nativeSessionIdSegment = session.nativeSessionId == null ? '' : ` native=${session.nativeSessionId}`;
  const line =
    `- ${session.id}${nativeSessionIdSegment} turns=${session.turns.length} ` +
    `created=${session.createdAt} last_accessed=${session.lastAccessedAt} ${buildLastTurnPreview(session)}`;

  return line;
};

export const handleSessions = (providerName: string): CallToolResult => {
  const sessions = SESSION_STORE.listByProvider(providerName).toSorted((left, right) =>
    right.lastAccessedAt.localeCompare(left.lastAccessedAt)
  );
  const lines = sessions.map((session) => buildSessionLine(session));
  const text = lines.length > 0 ? lines.join('\n') : '(no sessions)';
  const callToolResult: CallToolResult = {
    content: [{ type: 'text', text }],
  };

  return callToolResult;
};
