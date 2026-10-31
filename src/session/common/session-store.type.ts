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

export type SessionStoreEntry = {
  readonly id: string;
  readonly provider: string;
  turns: SessionTurn[];
  readonly createdAt: string;
  // eslint-disable-next-line local/readonly-type-properties -- the store refreshes the access time in place
  lastAccessedAt: string;
  // eslint-disable-next-line local/readonly-type-properties -- the store records the native id in place
  nativeSessionId?: string;
  // eslint-disable-next-line local/readonly-type-properties -- the store turns native start off in place
  isNativeStartDisabled?: boolean;
};
