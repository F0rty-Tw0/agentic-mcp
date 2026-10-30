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

describe('background-job-store retention', () => {
  beforeEach(() => {
    resetBackgroundJobStoreForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('getBackgroundJob TTL', () => {
    it('GIVEN a job completed longer ago than the TTL WHEN getBackgroundJob called THEN returns undefined', () => {
      const baseMs = 2_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const job = createBackgroundJob('claude');

      setBackgroundJobCompleted(job.id, { resultText: 'done' });
      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS + 1);

      const result = getBackgroundJob(job.id);

      expect(result).toBeUndefined();
    });

    it('GIVEN a running job older than the TTL WHEN getBackgroundJob called THEN returns the job', () => {
      const baseMs = 4_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const job = createBackgroundJob('claude');
      const running = setBackgroundJobRunning(job.id);

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS * 2);

      const result = getBackgroundJob(job.id);

      expect(result).toStrictEqual(running);
    });

    it('GIVEN a pending job older than the TTL WHEN getBackgroundJob called THEN returns the job', () => {
      const baseMs = 5_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const job = createBackgroundJob('claude');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS * 2);

      const result = getBackgroundJob(job.id);

      expect(result).toStrictEqual(job);
    });

    it('GIVEN a job created before the TTL but failed within it WHEN getBackgroundJob called THEN returns the job', () => {
      const baseMs = 6_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const job = createBackgroundJob('claude');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS);
      const failed = setBackgroundJobFailed(job.id, 'boom');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS * 2 - 1);

      const result = getBackgroundJob(job.id);

      expect(result).toStrictEqual(failed);
    });

    it('GIVEN a job within TTL WHEN getBackgroundJob called THEN returns the job', () => {
      const baseMs = 3_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const job = createBackgroundJob('claude');

      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS - 1);

      const result = getBackgroundJob(job.id);

      expect(result).toStrictEqual(job);
    });
  });

  describe('pruneExpiredJobs', () => {
    it('GIVEN existing expired jobs WHEN createBackgroundJob called THEN expired jobs are pruned', () => {
      const baseMs = 1_000_000;

      vi.spyOn(Date, 'now').mockReturnValue(baseMs);
      const expiredJob = createBackgroundJob('claude');

      setBackgroundJobCompleted(expiredJob.id, { resultText: 'done' });
      vi.spyOn(Date, 'now').mockReturnValue(baseMs + BACKGROUND_JOB_TTL_MS + 1);
      createBackgroundJob('claude');

      const retrieved = getBackgroundJob(expiredJob.id);

      expect(retrieved).toBeUndefined();
    });

    it('GIVEN a fresh and an expired job WHEN creating a new job THEN only the expired job is pruned', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const expired = createBackgroundJob('claude');

      setBackgroundJobCompleted(expired.id, { resultText: 'done' });
      vi.advanceTimersByTime(BACKGROUND_JOB_TTL_MS + 1);

      const fresh = createBackgroundJob('copilot');

      expect(getBackgroundJob(expired.id)).toBeUndefined();
      expect(getBackgroundJob(fresh.id)).toStrictEqual(fresh);
    });
  });

  describe('enforceBoundedCapacity', () => {
    it('GIVEN store at max capacity of finished jobs WHEN creating another job THEN evicts the oldest entry', () => {
      const firstJob = createBackgroundJob('claude');

      setBackgroundJobCompleted(firstJob.id, { resultText: 'done' });

      for (let i = 1; i < MAX_BACKGROUND_JOB_RECORDS + 1; i++) {
        createBackgroundJob('claude');
      }

      expect(getBackgroundJob(firstJob.id)).toBeUndefined();
    });

    it('GIVEN the oldest job is running WHEN capacity is exceeded THEN the oldest finished job is evicted instead', () => {
      const runningJob = createBackgroundJob('claude');
      const finishedJob = createBackgroundJob('claude');

      setBackgroundJobRunning(runningJob.id);
      setBackgroundJobFailed(finishedJob.id, 'boom');

      for (let i = 2; i < MAX_BACKGROUND_JOB_RECORDS + 1; i++) {
        createBackgroundJob('claude');
      }

      expect(getBackgroundJob(runningJob.id)?.state).toBe('running');
      expect(getBackgroundJob(finishedJob.id)).toBeUndefined();
    });

    it('GIVEN only pending jobs at max capacity WHEN creating another job THEN no job is evicted', () => {
      const firstJob = createBackgroundJob('claude');

      for (let i = 1; i < MAX_BACKGROUND_JOB_RECORDS + 1; i++) {
        createBackgroundJob('claude');
      }

      expect(getBackgroundJob(firstJob.id)).toStrictEqual(firstJob);
    });

    it('GIVEN store below capacity WHEN creating a job THEN does not evict any entries', () => {
      const first = createBackgroundJob('a');
      const second = createBackgroundJob('b');

      expect(getBackgroundJob(first.id)).toStrictEqual(first);
      expect(getBackgroundJob(second.id)).toStrictEqual(second);
    });
  });
});
