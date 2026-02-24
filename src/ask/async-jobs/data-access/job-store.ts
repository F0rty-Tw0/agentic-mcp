import { randomUUID } from 'node:crypto';

import { ASK_JOB_TTL_MS, MAX_ASK_JOB_RECORDS } from "../common";
import type { AskJobRecord } from "../common";

type AskJobStoreEntry = Readonly<{
  createdAtMs: number;
  record: AskJobRecord;
}>;

const askJobStore = new Map<string, AskJobStoreEntry>();

const nowIso = (): string => new Date().toISOString();

const pruneExpiredJobs = (nowMs: number): void => {
  for (const [id, entry] of askJobStore) {
    if (nowMs - entry.createdAtMs > ASK_JOB_TTL_MS) {
      askJobStore.delete(id);
    }
  }
};

const enforceBoundedCapacity = (): void => {
  while (askJobStore.size > MAX_ASK_JOB_RECORDS) {
    const oldestKey = askJobStore.keys().next().value;

    if (oldestKey == null) return;

    askJobStore.delete(oldestKey);
  }
};

const updateJob = (id: string, updater: (existing: AskJobRecord) => AskJobRecord): AskJobRecord | null => {
  const existingEntry = askJobStore.get(id);

  if (!existingEntry) return null;

  const nextRecord = updater(existingEntry.record);

  askJobStore.set(id, { ...existingEntry, record: nextRecord });

  return nextRecord;
};

export const createAskJob = (provider: string): AskJobRecord => {
  const nowMs = Date.now();
  const createdAt = nowIso();
  const id = randomUUID();
  const record: AskJobRecord = {
    id,
    provider,
    state: 'pending',
    createdAt,
    updatedAt: createdAt,
  };

  pruneExpiredJobs(nowMs);
  askJobStore.set(id, { createdAtMs: nowMs, record });
  enforceBoundedCapacity();

  return record;
};

export const setAskJobRunning = (id: string): AskJobRecord | null => {
  return updateJob(id, (existing) => ({
    ...existing,
    state: 'running',
    updatedAt: nowIso(),
  }));
};

export const setAskJobCompleted = (id: string, resultText: string): AskJobRecord | null => {
  return updateJob(id, (existing) => ({
    ...existing,
    state: 'completed',
    resultText,
    error: undefined,
    updatedAt: nowIso(),
  }));
};

export const setAskJobFailed = (id: string, error: string): AskJobRecord | null => {
  return updateJob(id, (existing) => ({
    ...existing,
    state: 'failed',
    error,
    resultText: undefined,
    updatedAt: nowIso(),
  }));
};

export const getAskJob = (id: string): AskJobRecord | null => {
  const nowMs = Date.now();

  pruneExpiredJobs(nowMs);

  const entry = askJobStore.get(id);

  if (!entry) return null;

  return entry.record;
};

export const resetAskJobStoreForTests = (): void => {
  askJobStore.clear();
};
