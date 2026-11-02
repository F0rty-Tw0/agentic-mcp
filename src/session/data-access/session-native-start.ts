import type { SessionStoreEntry } from '../common/session-store.type';

export const recordNativeSessionId = (entry: SessionStoreEntry | undefined, nativeSessionId: string): void => {
  if (!entry) return;

  entry.nativeSessionId = nativeSessionId;
  entry.lastAccessedAt = new Date().toISOString();
};

export const turnOffNativeStart = (entry: SessionStoreEntry | undefined): void => {
  if (!entry) return;

  entry.isNativeStartDisabled = true;
  entry.nativeSessionId = undefined;
};
