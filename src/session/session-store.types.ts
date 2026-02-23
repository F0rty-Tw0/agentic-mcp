export type SessionRole = 'user' | 'assistant';

export type SessionTurn = Readonly<{
  role: SessionRole;
  text: string;
  timestamp: string;
}>;

export type SessionRecord = Readonly<{
  id: string;
  provider: string;
  turns: readonly SessionTurn[];
  createdAt: string;
  lastAccessedAt: string;
  nativeSessionId?: string;
}>;
