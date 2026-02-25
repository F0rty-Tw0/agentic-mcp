import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBackgroundJob,
  getBackgroundJob,
  resetBackgroundJobStoreForTests,
  setBackgroundJobCompleted,
  setBackgroundJobFailed,
  setBackgroundJobRunning,
} from './job-store';
import { BACKGROUND_JOB_TTL_MS, MAX_BACKGROUND_JOB_RECORDS } from '../common';

describe('background-job-store', () => {
  beforeEach(() => {
    resetBackgroundJobStoreForTests();
    vi.restoreAllMocks();
  });

  describe('createBackgroundJob', () => {
    it('GIVEN a provider name WHEN createBackgroundJob called THEN returns record with state pending', () => {
      const record = createBackgroundJob('claude');

      expect(record.state).toBe('pending');
    });

    it('GIVEN a provider name WHEN createBackgroundJob called THEN returns record with the given provider', () => {
      const record = createBackgroundJob('claude');

      expect(record.provider).toBe('claude');
    });

    it('GIVEN a provider name WHEN createBackgroundJob called THEN returns record with a valid UUID id', () => {
      const record = createBackgroundJob('claude');

      expect(record.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('GIVEN a provider name WHEN createBackgroundJob called THEN returns record with ISO createdAt timestamp', () => {
      const record = createBackgroundJob('claude');

      expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('GIVEN a provider name WHEN createBackgroundJob called THEN returns record with ISO updatedAt timestamp', () => {
      const record = createBackgroundJob('claude');

      expect(record.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('GIVEN a provider name WHEN createBackgroundJob called THEN createdAt and updatedAt are equal', () => {
      const record = createBackgroundJob('claude');

      expect(record.createdAt).toBe(record.updatedAt);
    });

    it('GIVEN a provider name WHEN createBackgroundJob called THEN resultText is undefined', () => {
      const record = createBackgroundJob('claude');

      expect(record.resultText).toBeUndefined();
    });

    it('GIVEN a provider name WHEN createBackgroundJob called THEN error is undefined', () => {
      const record = createBackgroundJob('claude');

      expect(record.error).toBeUndefined();
    });

    it('GIVEN two jobs created WHEN ids compared THEN ids are unique', () => {
      const first = createBackgroundJob('claude');
      const second = createBackgroundJob('claude');

      expect(first.id).not.toBe(second.id);
    });

    it('GIVEN a provider WHEN creating a job THEN the job is retrievable by id', () => {
      const record = createBackgroundJob('claude');

      const retrieved = getBackgroundJob(record.id);

      expect(retrieved).toStrictEqual(record);
    });
  });

  describe('setBackgroundJobRunning', () => {
    it('GIVEN a pending job WHEN setBackgroundJobRunning called THEN returns record with state running', () => {
      const job = createBackgroundJob('claude');

      const result = setBackgroundJobRunning(job.id);

      expect(result?.state).toBe('running');
    });

    it('GIVEN a pending job WHEN setBackgroundJobRunning called THEN updatedAt is updated', () => {
      const job = createBackgroundJob('claude');
      const originalUpdatedAt = job.updatedAt;

      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2099-01-01T00:00:00.000Z');

      const result = setBackgroundJobRunning(job.id);

      expect(result?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('GIVEN a pending job WHEN setBackgroundJobRunning called THEN provider is preserved', () => {
      const job = createBackgroundJob('claude');

      const result = setBackgroundJobRunning(job.id);

      expect(result?.provider).toBe('claude');
    });

    it('GIVEN an unknown id WHEN setBackgroundJobRunning called THEN returns null', () => {
      const result = setBackgroundJobRunning('non-existent-id');

      expect(result).toBeUndefined();
    });
  });

  describe('setBackgroundJobCompleted', () => {
    it('GIVEN a running job WHEN setBackgroundJobCompleted called THEN returns record with state completed', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobRunning(job.id);

      const result = setBackgroundJobCompleted(job.id, 'the answer');

      expect(result?.state).toBe('completed');
    });

    it('GIVEN a running job WHEN setBackgroundJobCompleted called THEN resultText matches provided text', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobRunning(job.id);

      const result = setBackgroundJobCompleted(job.id, 'the answer');

      expect(result?.resultText).toBe('the answer');
    });

    it('GIVEN a job that previously had an error WHEN setBackgroundJobCompleted called THEN error is cleared', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobFailed(job.id, 'oops');

      const result = setBackgroundJobCompleted(job.id, 'recovered');

      expect(result?.error).toBeUndefined();
    });

    it('GIVEN a running job WHEN setBackgroundJobCompleted called THEN updatedAt is updated', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobRunning(job.id);

      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2099-06-15T12:00:00.000Z');

      const result = setBackgroundJobCompleted(job.id, 'done');

      expect(result?.updatedAt).toBe('2099-06-15T12:00:00.000Z');
    });

    it('GIVEN an unknown id WHEN setBackgroundJobCompleted called THEN returns null', () => {
      const result = setBackgroundJobCompleted('non-existent-id', 'text');

      expect(result).toBeUndefined();
    });
  });

  describe('setBackgroundJobFailed', () => {
    it('GIVEN a running job WHEN setBackgroundJobFailed called THEN returns record with state failed', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobRunning(job.id);

      const result = setBackgroundJobFailed(job.id, 'something went wrong');

      expect(result?.state).toBe('failed');
    });

    it('GIVEN a running job WHEN setBackgroundJobFailed called THEN error matches provided message', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobRunning(job.id);

      const result = setBackgroundJobFailed(job.id, 'something went wrong');

      expect(result?.error).toBe('something went wrong');
    });

    it('GIVEN a job that previously had resultText WHEN setBackgroundJobFailed called THEN resultText is cleared', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobCompleted(job.id, 'previous result');

      const result = setBackgroundJobFailed(job.id, 'now failed');

      expect(result?.resultText).toBeUndefined();
    });

    it('GIVEN a running job WHEN setBackgroundJobFailed called THEN updatedAt is updated', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobRunning(job.id);

      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2099-03-10T08:00:00.000Z');

      const result = setBackgroundJobFailed(job.id, 'error');

      expect(result?.updatedAt).toBe('2099-03-10T08:00:00.000Z');
    });

    it('GIVEN an unknown id WHEN setBackgroundJobFailed called THEN returns null', () => {
      const result = setBackgroundJobFailed('non-existent-id', 'error');

      expect(result).toBeUndefined();
    });
  });

  describe('getBackgroundJob', () => {
    it('GIVEN an existing job WHEN getBackgroundJob called THEN returns the job record', () => {
      const job = createBackgroundJob('claude');

      const result = getBackgroundJob(job.id);

      expect(result).toStrictEqual(job);
    });

    it('GIVEN an existing job WHEN getBackgroundJob called THEN returned record has correct provider', () => {
      const job = createBackgroundJob('codex');

      const result = getBackgroundJob(job.id);

      expect(result?.provider).toBe('codex');
    });

    it('GIVEN an unknown id WHEN getBackgroundJob called THEN returns null', () => {
      const result = getBackgroundJob('non-existent-id');

      expect(result).toBeUndefined();
    });

    it('GIVEN an expired job WHEN getBackgroundJob called THEN returns null', () => {
      const baseMs = 2_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const job = createBackgroundJob('claude');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS + 1);

      const result = getBackgroundJob(job.id);

      expect(result).toBeUndefined();
    });

    it('GIVEN a job within TTL WHEN getBackgroundJob called THEN returns the job', () => {
      const baseMs = 3_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const job = createBackgroundJob('claude');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS - 1);

      const result = getBackgroundJob(job.id);

      expect(result).toStrictEqual(job);
    });

    it('GIVEN a completed job WHEN getBackgroundJob called THEN returns record with resultText', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobCompleted(job.id, 'final output');

      const result = getBackgroundJob(job.id);

      expect(result?.resultText).toBe('final output');
    });

    it('GIVEN a failed job WHEN getBackgroundJob called THEN returns record with error', () => {
      const job = createBackgroundJob('claude');

      setBackgroundJobFailed(job.id, 'timeout');

      const result = getBackgroundJob(job.id);

      expect(result?.error).toBe('timeout');
    });
  });

  describe('pruneExpiredJobs', () => {
    it('GIVEN existing expired jobs WHEN createBackgroundJob called THEN expired jobs are pruned', () => {
      const baseMs = 1_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const expiredJob = createBackgroundJob('claude');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS + 1);
      createBackgroundJob('claude');

      const retrieved = getBackgroundJob(expiredJob.id);

      expect(retrieved).toBeUndefined();
    });

    it('GIVEN a fresh and an expired job WHEN creating a new job THEN only the expired job is pruned', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const expired = createBackgroundJob('claude');

      vi.advanceTimersByTime(BACKGROUND_JOB_TTL_MS + 1);

      const fresh = createBackgroundJob('copilot');

      expect(getBackgroundJob(expired.id)).toBeUndefined();
      expect(getBackgroundJob(fresh.id)).toStrictEqual(fresh);
    });
  });

  describe('enforceBoundedCapacity', () => {
    it('GIVEN store at max capacity WHEN creating another job THEN evicts the oldest entry', () => {
      const firstJob = createBackgroundJob('claude');

      for (let i = 1; i < MAX_BACKGROUND_JOB_RECORDS + 1; i++) {
        createBackgroundJob('claude');
      }

      expect(getBackgroundJob(firstJob.id)).toBeUndefined();
    });

    it('GIVEN store below capacity WHEN creating a job THEN does not evict any entries', () => {
      const first = createBackgroundJob('a');
      const second = createBackgroundJob('b');

      expect(getBackgroundJob(first.id)).toStrictEqual(first);
      expect(getBackgroundJob(second.id)).toStrictEqual(second);
    });
  });

  describe('resetBackgroundJobStoreForTests', () => {
    it('GIVEN jobs in the store WHEN resetBackgroundJobStoreForTests called THEN previously created job is not retrievable', () => {
      const job = createBackgroundJob('claude');

      resetBackgroundJobStoreForTests();

      const result = getBackgroundJob(job.id);

      expect(result).toBeUndefined();
    });

    it('GIVEN jobs in the store WHEN resetBackgroundJobStoreForTests called THEN new jobs can still be created', () => {
      createBackgroundJob('claude');
      resetBackgroundJobStoreForTests();

      const fresh = createBackgroundJob('codex');
      const result = getBackgroundJob(fresh.id);

      expect(result?.provider).toBe('codex');
    });
  });
});
