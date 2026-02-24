import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAskJob,
  getAskJob,
  resetAskJobStoreForTests,
  setAskJobCompleted,
  setAskJobFailed,
  setAskJobRunning,
} from './job-store.ts';
import { ASK_JOB_TTL_MS, MAX_ASK_JOB_RECORDS } from '../common/index.ts';

describe('ask-job-store', () => {
  beforeEach(() => {
    resetAskJobStoreForTests();
    vi.restoreAllMocks();
  });

  describe('createAskJob', () => {
    it('GIVEN a provider name WHEN createAskJob called THEN returns record with state pending', () => {
      const record = createAskJob('claude');

      expect(record.state).toBe('pending');
    });

    it('GIVEN a provider name WHEN createAskJob called THEN returns record with the given provider', () => {
      const record = createAskJob('claude');

      expect(record.provider).toBe('claude');
    });

    it('GIVEN a provider name WHEN createAskJob called THEN returns record with a valid UUID id', () => {
      const record = createAskJob('claude');

      expect(record.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('GIVEN a provider name WHEN createAskJob called THEN returns record with ISO createdAt timestamp', () => {
      const record = createAskJob('claude');

      expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('GIVEN a provider name WHEN createAskJob called THEN returns record with ISO updatedAt timestamp', () => {
      const record = createAskJob('claude');

      expect(record.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('GIVEN a provider name WHEN createAskJob called THEN createdAt and updatedAt are equal', () => {
      const record = createAskJob('claude');

      expect(record.createdAt).toBe(record.updatedAt);
    });

    it('GIVEN a provider name WHEN createAskJob called THEN resultText is undefined', () => {
      const record = createAskJob('claude');

      expect(record.resultText).toBeUndefined();
    });

    it('GIVEN a provider name WHEN createAskJob called THEN error is undefined', () => {
      const record = createAskJob('claude');

      expect(record.error).toBeUndefined();
    });

    it('GIVEN two jobs created WHEN ids compared THEN ids are unique', () => {
      const first = createAskJob('claude');
      const second = createAskJob('claude');

      expect(first.id).not.toBe(second.id);
    });

    it('GIVEN existing expired jobs WHEN createAskJob called THEN expired jobs are pruned', () => {
      const baseMs = 1_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const expiredJob = createAskJob('claude');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + ASK_JOB_TTL_MS + 1);
      createAskJob('claude');

      const retrieved = getAskJob(expiredJob.id);

      expect(retrieved).toBeNull();
    });

    it('GIVEN store at MAX_ASK_JOB_RECORDS WHEN createAskJob called THEN oldest entry is evicted to stay within capacity', () => {
      const firstJob = createAskJob('claude');

      for (let i = 1; i < MAX_ASK_JOB_RECORDS + 1; i++) {
        createAskJob('claude');
      }

      expect(getAskJob(firstJob.id)).toBeNull();
    });

    it('GIVEN store exceeds MAX_ASK_JOB_RECORDS WHEN oldest job retrieved THEN oldest job was evicted', () => {
      const first = createAskJob('claude');

      for (let i = 0; i < MAX_ASK_JOB_RECORDS; i++) {
        createAskJob('filler');
      }

      const retrieved = getAskJob(first.id);

      expect(retrieved).toBeNull();
    });
  });

  describe('setAskJobRunning', () => {
    it('GIVEN a pending job WHEN setAskJobRunning called THEN returns record with state running', () => {
      const job = createAskJob('claude');

      const result = setAskJobRunning(job.id);

      expect(result?.state).toBe('running');
    });

    it('GIVEN a pending job WHEN setAskJobRunning called THEN updatedAt is updated', () => {
      const job = createAskJob('claude');
      const originalUpdatedAt = job.updatedAt;

      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2099-01-01T00:00:00.000Z');

      const result = setAskJobRunning(job.id);

      expect(result?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('GIVEN a pending job WHEN setAskJobRunning called THEN provider is preserved', () => {
      const job = createAskJob('claude');

      const result = setAskJobRunning(job.id);

      expect(result?.provider).toBe('claude');
    });

    it('GIVEN an unknown id WHEN setAskJobRunning called THEN returns null', () => {
      const result = setAskJobRunning('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('setAskJobCompleted', () => {
    it('GIVEN a running job WHEN setAskJobCompleted called THEN returns record with state completed', () => {
      const job = createAskJob('claude');

      setAskJobRunning(job.id);

      const result = setAskJobCompleted(job.id, 'the answer');

      expect(result?.state).toBe('completed');
    });

    it('GIVEN a running job WHEN setAskJobCompleted called THEN resultText matches provided text', () => {
      const job = createAskJob('claude');

      setAskJobRunning(job.id);

      const result = setAskJobCompleted(job.id, 'the answer');

      expect(result?.resultText).toBe('the answer');
    });

    it('GIVEN a job that previously had an error WHEN setAskJobCompleted called THEN error is cleared', () => {
      const job = createAskJob('claude');

      setAskJobFailed(job.id, 'oops');

      const result = setAskJobCompleted(job.id, 'recovered');

      expect(result?.error).toBeUndefined();
    });

    it('GIVEN a running job WHEN setAskJobCompleted called THEN updatedAt is updated', () => {
      const job = createAskJob('claude');

      setAskJobRunning(job.id);

      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2099-06-15T12:00:00.000Z');

      const result = setAskJobCompleted(job.id, 'done');

      expect(result?.updatedAt).toBe('2099-06-15T12:00:00.000Z');
    });

    it('GIVEN an unknown id WHEN setAskJobCompleted called THEN returns null', () => {
      const result = setAskJobCompleted('non-existent-id', 'text');

      expect(result).toBeNull();
    });
  });

  describe('setAskJobFailed', () => {
    it('GIVEN a running job WHEN setAskJobFailed called THEN returns record with state failed', () => {
      const job = createAskJob('claude');

      setAskJobRunning(job.id);

      const result = setAskJobFailed(job.id, 'something went wrong');

      expect(result?.state).toBe('failed');
    });

    it('GIVEN a running job WHEN setAskJobFailed called THEN error matches provided message', () => {
      const job = createAskJob('claude');

      setAskJobRunning(job.id);

      const result = setAskJobFailed(job.id, 'something went wrong');

      expect(result?.error).toBe('something went wrong');
    });

    it('GIVEN a job that previously had resultText WHEN setAskJobFailed called THEN resultText is cleared', () => {
      const job = createAskJob('claude');

      setAskJobCompleted(job.id, 'previous result');

      const result = setAskJobFailed(job.id, 'now failed');

      expect(result?.resultText).toBeUndefined();
    });

    it('GIVEN a running job WHEN setAskJobFailed called THEN updatedAt is updated', () => {
      const job = createAskJob('claude');

      setAskJobRunning(job.id);

      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2099-03-10T08:00:00.000Z');

      const result = setAskJobFailed(job.id, 'error');

      expect(result?.updatedAt).toBe('2099-03-10T08:00:00.000Z');
    });

    it('GIVEN an unknown id WHEN setAskJobFailed called THEN returns null', () => {
      const result = setAskJobFailed('non-existent-id', 'error');

      expect(result).toBeNull();
    });
  });

  describe('getAskJob', () => {
    it('GIVEN an existing job WHEN getAskJob called THEN returns the job record', () => {
      const job = createAskJob('claude');

      const result = getAskJob(job.id);

      expect(result).toStrictEqual(job);
    });

    it('GIVEN an existing job WHEN getAskJob called THEN returned record has correct provider', () => {
      const job = createAskJob('codex');

      const result = getAskJob(job.id);

      expect(result?.provider).toBe('codex');
    });

    it('GIVEN an unknown id WHEN getAskJob called THEN returns null', () => {
      const result = getAskJob('non-existent-id');

      expect(result).toBeNull();
    });

    it('GIVEN an expired job WHEN getAskJob called THEN returns null', () => {
      const baseMs = 2_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const job = createAskJob('claude');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + ASK_JOB_TTL_MS + 1);

      const result = getAskJob(job.id);

      expect(result).toBeNull();
    });

    it('GIVEN a job within TTL WHEN getAskJob called THEN returns the job', () => {
      const baseMs = 3_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const job = createAskJob('claude');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + ASK_JOB_TTL_MS - 1);

      const result = getAskJob(job.id);

      expect(result).toStrictEqual(job);
    });

    it('GIVEN a completed job WHEN getAskJob called THEN returns record with resultText', () => {
      const job = createAskJob('claude');

      setAskJobCompleted(job.id, 'final output');

      const result = getAskJob(job.id);

      expect(result?.resultText).toBe('final output');
    });

    it('GIVEN a failed job WHEN getAskJob called THEN returns record with error', () => {
      const job = createAskJob('claude');

      setAskJobFailed(job.id, 'timeout');

      const result = getAskJob(job.id);

      expect(result?.error).toBe('timeout');
    });
  });

  describe('resetAskJobStoreForTests', () => {
    it('GIVEN jobs in the store WHEN resetAskJobStoreForTests called THEN previously created job is not retrievable', () => {
      const job = createAskJob('claude');

      resetAskJobStoreForTests();

      const result = getAskJob(job.id);

      expect(result).toBeNull();
    });

    it('GIVEN jobs in the store WHEN resetAskJobStoreForTests called THEN new jobs can still be created', () => {
      createAskJob('claude');
      resetAskJobStoreForTests();

      const fresh = createAskJob('codex');
      const result = getAskJob(fresh.id);

      expect(result?.provider).toBe('codex');
    });
  });
});
