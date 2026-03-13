import { randomUUID } from 'node:crypto';

import { nowIso } from '../../shared';
import { BACKGROUND_JOB_TTL_MS, MAX_BACKGROUND_JOB_RECORDS, MAX_RESULT_TEXT_LENGTH } from '../common';
import type { BackgroundJobCompletionInput, BackgroundJobRecord } from '../common';

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
  for (
    let oldestKey = backgroundJobStore.keys().next().value;
    backgroundJobStore.size > MAX_BACKGROUND_JOB_RECORDS && oldestKey !== undefined;
    oldestKey = backgroundJobStore.keys().next().value
  ) {
    backgroundJobStore.delete(oldestKey);
  }
};

const truncateResultText = (text: string): string => {
  if (text.length <= MAX_RESULT_TEXT_LENGTH) return text;

  return text.slice(0, MAX_RESULT_TEXT_LENGTH);
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

export const setBackgroundJobCompleted = (
  id: string,
  backgroundJobCompletionInput: BackgroundJobCompletionInput
): BackgroundJobRecord | undefined => {
  const { resultText, structuredContent } = backgroundJobCompletionInput;

  return updateJob(id, (existing) => ({
    ...existing,
    state: 'completed',
    resultText: truncateResultText(resultText),
    structuredContent,
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
    structuredContent: undefined,
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
