export { buildJobStatusResponse, startBackgroundInvocation } from './domain-logic/background';

export {
  createBackgroundJob,
  getBackgroundJob,
  setBackgroundJobRunning,
  setBackgroundJobCompleted,
  setBackgroundJobFailed,
  resetBackgroundJobStoreForTests,
} from './data-access/job-store';

export type { BackgroundJobRecord, BackgroundJobStatusPayload } from './common/job.types';

export { BACKGROUND_JOB_TTL_MS, MAX_BACKGROUND_JOB_RECORDS } from './common/job.const';
