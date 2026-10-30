type SessionRole = 'user' | 'assistant';

export type SessionTurn = {
  readonly role: SessionRole;
  readonly text: string;
  readonly timestamp: string;
};

export type SessionRecord = {
  readonly id: string;
  readonly provider: string;
  readonly turns: SessionTurn[];
  readonly createdAt: string;
  readonly lastAccessedAt: string;
  readonly nativeSessionId?: string;
};
