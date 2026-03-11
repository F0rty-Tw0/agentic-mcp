import type { SessionRecord, SessionTurn } from '../common/session-store.type';

export const toSessionKey = (provider: string, id: string): string => {
  const result = `${provider}:${id}`;

  return result;
};

export const cloneRecord = (entry: SessionRecord): SessionRecord => {
  const result: SessionRecord = {
    id: entry.id,
    provider: entry.provider,
    turns: [...entry.turns],
    createdAt: entry.createdAt,
    lastAccessedAt: entry.lastAccessedAt,
    nativeSessionId: entry.nativeSessionId,
  };

  return result;
};

export const formatTurns = (turns: readonly SessionTurn[]): string => {
  const result = turns.map((turn) => `${turn.role}: ${turn.text}`).join('\n');

  return result;
};

export const capTurnsByBytes = (turns: readonly SessionTurn[], maxContextBytes: number): readonly SessionTurn[] => {
  const result: SessionTurn[] = [];

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const currentTurn = turns[index];

    if (!currentTurn) continue;

    const nextTurns = [currentTurn, ...result];

    if (Buffer.byteLength(formatTurns(nextTurns), 'utf-8') > maxContextBytes) break;

    result.unshift(currentTurn);
  }

  return result;
};
