import { randomUUID } from 'node:crypto';

import { nowIso } from '../../shared/utils';
import { BACKGROUND_JOB_TTL_MS, MAX_BACKGROUND_JOB_RECORDS } from '../common';
import type { BackgroundJobRecord } from '../common';

type BackgroundJobStoreEntry = Readonly<{
  createdAtMs: number;
  record: BackgroundJobRecord;
}>;

const backgroundJobStore = new Map<string, BackgroundJobStoreEntry>();

const pruneExpiredJobs = (nowMs: number): void => {
  for (const [id, entry] of backgroundJobStore) {
    if (nowMs - entry.createdAtMs > BACKGROUND_JOB_TTL_MS) {
      backgroundJobStore.delete(id);
    }
  }
};

const enforceBoundedCapacity = (): void => {
  while (backgroundJobStore.size > MAX_BACKGROUND_JOB_RECORDS) {
    const oldestKey = backgroundJobStore.keys().next().value;

    if (oldestKey === undefined) return;

    backgroundJobStore.delete(oldestKey);
  }
};

const updateJob = (
  id: string,
  updater: (existing: BackgroundJobRecord) => BackgroundJobRecord
): BackgroundJobRecord | undefined => {
  const existingEntry = backgroundJobStore.get(id);

  if (!existingEntry) return;

  const nextRecord = updater(existingEntry.record);

  const storeEntry: BackgroundJobStoreEntry = { ...existingEntry, record: nextRecord };

  backgroundJobStore.set(id, storeEntry);

  return nextRecord;
};

export const createBackgroundJob = (provider: string): BackgroundJobRecord => {
  const nowMs = Date.now();
  const createdAt = nowIso();
  const id = randomUUID();
  const record: BackgroundJobRecord = {
    id,
    provider,
    state: 'pending',
    createdAt,
    updatedAt: createdAt,
  };

  pruneExpiredJobs(nowMs);

  const storeEntry: BackgroundJobStoreEntry = { createdAtMs: nowMs, record };

  backgroundJobStore.set(id, storeEntry);

  enforceBoundedCapacity();

  return record;
};

export const setBackgroundJobRunning = (id: string): BackgroundJobRecord | undefined => {
  return updateJob(id, (existing) => ({
    ...existing,
    state: 'running',
    updatedAt: nowIso(),
  }));
};

export const setBackgroundJobCompleted = (id: string, resultText: string): BackgroundJobRecord | undefined => {
  return updateJob(id, (existing) => ({
    ...existing,
    state: 'completed',
    resultText,
    error: undefined,
    updatedAt: nowIso(),
  }));
};

export const setBackgroundJobFailed = (id: string, error: string): BackgroundJobRecord | undefined => {
  return updateJob(id, (existing) => ({
    ...existing,
    state: 'failed',
    error,
    resultText: undefined,
    updatedAt: nowIso(),
  }));
};

export const getBackgroundJob = (id: string): BackgroundJobRecord | undefined => {
  const nowMs = Date.now();

  pruneExpiredJobs(nowMs);

  const entry = backgroundJobStore.get(id);

  if (!entry) return;

  return entry.record;
};

export const resetBackgroundJobStoreForTests = (): void => {
  backgroundJobStore.clear();
};
