import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { ValidationError } from '../../shared';

const LOCK_RETRY_DELAY_MS = 10;
const LOCK_STALE_MS = 30_000;
const LOCK_TIMEOUT_MS = 5_000;

type ReleaseMetricsFileLock = () => Promise<void>;

const isSystemError = (error: unknown): error is NodeJS.ErrnoException => {
  const result = error instanceof Error && 'code' in error;

  return result;
};

const delay = async (durationMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
};

const isStaleLockDirectory = async (lockDirectoryPath: string): Promise<boolean> => {
  try {
    const details = await stat(lockDirectoryPath);
    const ageMs = Date.now() - details.mtimeMs;
    const result = ageMs > LOCK_STALE_MS;

    return result;
  } catch (error: unknown) {
    if (isSystemError(error) && error.code === 'ENOENT') return false;

    const message = error instanceof Error ? error.message : 'Unknown stat error';

    throw new ValidationError(`Unable to inspect provider metrics lock: ${message}`);
  }
};

const removeStaleLockDirectory = async (lockDirectoryPath: string): Promise<void> => {
  const staleLockDirectory = await isStaleLockDirectory(lockDirectoryPath);

  if (!staleLockDirectory) return;

  await rm(lockDirectoryPath, { force: true, recursive: true });
};

const tryCreateLockDirectory = async (lockDirectoryPath: string): Promise<boolean> => {
  try {
    await mkdir(lockDirectoryPath);

    return true;
  } catch (error: unknown) {
    if (isSystemError(error) && error.code === 'EEXIST') return false;

    const message = error instanceof Error ? error.message : 'Unknown mkdir error';

    throw new ValidationError(`Unable to acquire provider metrics lock: ${message}`);
  }
};

const waitForLockDirectory = async (lockDirectoryPath: string): Promise<void> => {
  const deadlineAt = Date.now() + LOCK_TIMEOUT_MS;

  for (let now = Date.now(); now < deadlineAt; now = Date.now()) {
    const lockDirectoryCreated = await tryCreateLockDirectory(lockDirectoryPath);

    if (lockDirectoryCreated) return;

    await removeStaleLockDirectory(lockDirectoryPath);
    await delay(LOCK_RETRY_DELAY_MS);
  }

  throw new ValidationError('Timed out waiting for provider metrics lock.');
};

export const acquireProviderMetricsFileLock = async (metricsFilePath: string): Promise<ReleaseMetricsFileLock> => {
  const lockDirectoryPath = `${metricsFilePath}.lock`;

  await mkdir(path.dirname(lockDirectoryPath), { recursive: true });
  await waitForLockDirectory(lockDirectoryPath);

  const releaseMetricsFileLock: ReleaseMetricsFileLock = async () => {
    await rm(lockDirectoryPath, { force: true, recursive: true });
  };

  return releaseMetricsFileLock;
};
