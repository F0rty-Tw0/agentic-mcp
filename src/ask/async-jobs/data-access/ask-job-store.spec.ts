import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAskJob,
  getAskJob,
  resetAskJobStoreForTests,
  setAskJobCompleted,
  setAskJobFailed,
  setAskJobRunning,
} from './ask-job-store.ts';
import { ASK_JOB_TTL_MS, MAX_ASK_JOB_RECORDS } from '../common/index.ts';

describe('ask-job-store', () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetAskJobStoreForTests();
  });

  describe('createAskJob', () => {
    it('GIVEN a provider WHEN creating a job THEN returns a record with pending state', () => {
      const record = createAskJob('claude');

      expect(record.state).toBe('pending');
      expect(record.provider).toBe('claude');
    });

    it('GIVEN a provider WHEN creating a job THEN returns a record with a uuid id', () => {
      const record = createAskJob('claude');

      expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('GIVEN a provider WHEN creating a job THEN sets createdAt and updatedAt to the same ISO timestamp', () => {
      const record = createAskJob('claude');

      expect(record.createdAt).toStrictEqual(record.updatedAt);
      expect(() => new Date(record.createdAt)).not.toThrow();
    });

    it('GIVEN a provider WHEN creating a job THEN the job is retrievable by id', () => {
      const record = createAskJob('claude');

      const retrieved = getAskJob(record.id);

      expect(retrieved).toStrictEqual(record);
    });
  });

  describe('setAskJobRunning', () => {
    it('GIVEN an existing job WHEN setting it to running THEN returns a record with running state', () => {
      const created = createAskJob('claude');

      const updated = setAskJobRunning(created.id);

      if (!updated) throw new Error('expected running record');

      expect(updated.state).toBe('running');
    });

    it('GIVEN an existing job WHEN setting it to running THEN updates the updatedAt timestamp', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const created = createAskJob('claude');

      vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'));

      const updated = setAskJobRunning(created.id);

      if (!updated) throw new Error('expected running record');

      expect(updated.updatedAt).toBe('2026-01-01T00:00:01.000Z');
      expect(updated.updatedAt).not.toStrictEqual(created.updatedAt);
    });

    it('GIVEN a non-existent id WHEN setting it to running THEN returns null', () => {
      const result = setAskJobRunning('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('setAskJobCompleted', () => {
    it('GIVEN an existing job WHEN setting it to completed THEN returns a record with completed state and resultText', () => {
      const created = createAskJob('claude');

      const updated = setAskJobCompleted(created.id, 'the answer');

      if (!updated) throw new Error('expected completed record');

      expect(updated.state).toBe('completed');
      expect(updated.resultText).toBe('the answer');
    });

    it('GIVEN an existing job WHEN setting it to completed THEN clears the error field', () => {
      const created = createAskJob('claude');

      setAskJobFailed(created.id, 'some error');

      const updated = setAskJobCompleted(created.id, 'recovered');

      if (!updated) throw new Error('expected completed record');

      expect(updated.error).toBeUndefined();
    });

    it('GIVEN a non-existent id WHEN setting it to completed THEN returns null', () => {
      const result = setAskJobCompleted('non-existent-id', 'text');

      expect(result).toBeNull();
    });
  });

  describe('setAskJobFailed', () => {
    it('GIVEN an existing job WHEN setting it to failed THEN returns a record with failed state and error', () => {
      const created = createAskJob('claude');

      const updated = setAskJobFailed(created.id, 'timeout');

      if (!updated) throw new Error('expected failed record');

      expect(updated.state).toBe('failed');
      expect(updated.error).toBe('timeout');
    });

    it('GIVEN an existing job WHEN setting it to failed THEN clears the resultText field', () => {
      const created = createAskJob('claude');

      setAskJobCompleted(created.id, 'some result');

      const updated = setAskJobFailed(created.id, 'late failure');

      if (!updated) throw new Error('expected failed record');

      expect(updated.resultText).toBeUndefined();
    });

    it('GIVEN a non-existent id WHEN setting it to failed THEN returns null', () => {
      const result = setAskJobFailed('non-existent-id', 'error');

      expect(result).toBeNull();
    });
  });

  describe('getAskJob', () => {
    it('GIVEN an existing job WHEN retrieving it THEN returns the record', () => {
      const created = createAskJob('claude');

      const retrieved = getAskJob(created.id);

      expect(retrieved).toStrictEqual(created);
    });

    it('GIVEN a non-existent id WHEN retrieving it THEN returns null', () => {
      const result = getAskJob('does-not-exist');

      expect(result).toBeNull();
    });

    it('GIVEN an expired job WHEN retrieving it THEN returns null', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const created = createAskJob('claude');

      vi.advanceTimersByTime(ASK_JOB_TTL_MS + 1);

      const result = getAskJob(created.id);

      expect(result).toBeNull();
    });

    it('GIVEN a job within TTL WHEN retrieving it THEN returns the record', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const created = createAskJob('claude');

      vi.advanceTimersByTime(ASK_JOB_TTL_MS - 1);

      const result = getAskJob(created.id);

      expect(result).toStrictEqual(created);
    });
  });

  describe('pruneExpiredJobs', () => {
    it('GIVEN multiple jobs with some expired WHEN creating a new job THEN expired jobs are pruned', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const expired = createAskJob('claude');

      vi.advanceTimersByTime(ASK_JOB_TTL_MS + 1);

      const fresh = createAskJob('copilot');

      expect(getAskJob(expired.id)).toBeNull();
      expect(getAskJob(fresh.id)).toStrictEqual(fresh);
    });
  });

  describe('enforceBoundedCapacity', () => {
    it('GIVEN store at max capacity WHEN creating another job THEN evicts the oldest entry', () => {
      const first = createAskJob('provider-0');

      for (let i = 1; i < MAX_ASK_JOB_RECORDS; i++) {
        createAskJob(`provider-${String(i)}`);
      }

      const overflow = createAskJob('overflow');

      expect(getAskJob(first.id)).toBeNull();
      expect(getAskJob(overflow.id)).toStrictEqual(overflow);
    });

    it('GIVEN store below capacity WHEN creating a job THEN does not evict any entries', () => {
      const first = createAskJob('a');
      const second = createAskJob('b');

      expect(getAskJob(first.id)).toStrictEqual(first);
      expect(getAskJob(second.id)).toStrictEqual(second);
    });
  });

  describe('resetAskJobStoreForTests', () => {
    it('GIVEN existing jobs WHEN resetting the store THEN all jobs are removed', () => {
      const first = createAskJob('a');
      const second = createAskJob('b');

      resetAskJobStoreForTests();

      expect(getAskJob(first.id)).toBeNull();
      expect(getAskJob(second.id)).toBeNull();
    });
  });
});
