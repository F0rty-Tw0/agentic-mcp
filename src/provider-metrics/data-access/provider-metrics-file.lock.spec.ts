import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { acquireProviderMetricsFileLock } from './provider-metrics-file.lock';

type FsModule = typeof fs;

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<FsModule>();

  return {
    ...actual,
    mkdir: vi.fn(actual.mkdir),
    rm: vi.fn(actual.rm),
    stat: vi.fn(actual.stat),
  };
});

const tempDirs: string[] = [];

const readActualFs = async (): Promise<FsModule> => {
  const actual = await vi.importActual<FsModule>('node:fs/promises');

  return actual;
};
const resetFsMocks = async (): Promise<void> => {
  const actual = await readActualFs();

  vi.mocked(fs.mkdir).mockReset();
  vi.mocked(fs.mkdir).mockImplementation(actual.mkdir);
  vi.mocked(fs.rm).mockReset();
  vi.mocked(fs.rm).mockImplementation(actual.rm);
  vi.mocked(fs.stat).mockReset();
  vi.mocked(fs.stat).mockImplementation(actual.stat);
};

const createTempDir = async (): Promise<string> => {
  const actualFs = await readActualFs();
  const directoryPath = await actualFs.mkdtemp(path.join(os.tmpdir(), 'agentic-mcp-provider-metrics-lock-'));

  tempDirs.push(directoryPath);

  return directoryPath;
};

const createMetricsFilePath = async (): Promise<string> => {
  const directoryPath = await createTempDir();
  const metricsFilePath = path.join(directoryPath, 'state', 'provider-metrics.json');

  return metricsFilePath;
};

const createSystemError = (code: string, message: string): NodeJS.ErrnoException => {
  const systemError = new Error(message) as NodeJS.ErrnoException;

  systemError.code = code;

  return systemError;
};

const removeDirectory = async (directoryPath: string): Promise<void> => {
  const actualFs = await readActualFs();

  await actualFs.rm(directoryPath, { recursive: true, force: true });
};

beforeEach(async () => {
  await resetFsMocks();
});

afterEach(async () => {
  const actualFs = await readActualFs();

  vi.restoreAllMocks();
  vi.useRealTimers();

  for (const directoryPath of tempDirs) {
    await actualFs.rm(directoryPath, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

describe('acquireProviderMetricsFileLock', () => {
  it('GIVEN an unlocked metrics file WHEN acquiring and releasing THEN creates and removes the lock directory', async () => {
    const actualFs = await readActualFs();
    const metricsFilePath = await createMetricsFilePath();
    const lockDirectoryPath = `${metricsFilePath}.lock`;

    const releaseProviderMetricsFileLock = await acquireProviderMetricsFileLock(metricsFilePath);

    await expect(actualFs.stat(lockDirectoryPath)).resolves.toBeDefined();
    await releaseProviderMetricsFileLock();
    await expect(actualFs.stat(lockDirectoryPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('GIVEN an existing lock directory WHEN it clears shortly after THEN waits and acquires the lock', async () => {
    const actualFs = await readActualFs();
    const metricsFilePath = await createMetricsFilePath();
    const lockDirectoryPath = `${metricsFilePath}.lock`;

    await actualFs.mkdir(lockDirectoryPath, { recursive: true });
    setTimeout(() => {
      void removeDirectory(lockDirectoryPath);
    }, 25);

    const releaseProviderMetricsFileLock = await acquireProviderMetricsFileLock(metricsFilePath);

    await expect(actualFs.stat(lockDirectoryPath)).resolves.toBeDefined();
    await releaseProviderMetricsFileLock();
  });

  it('GIVEN a stale lock directory WHEN acquiring the lock THEN removes the stale directory before re-locking', async () => {
    const actualFs = await readActualFs();
    const metricsFilePath = await createMetricsFilePath();
    const lockDirectoryPath = `${metricsFilePath}.lock`;
    const staleMarkerPath = path.join(lockDirectoryPath, 'stale.txt');
    const staleTimestamp = new Date(Date.now() - 31_000);

    await actualFs.mkdir(lockDirectoryPath, { recursive: true });
    await actualFs.writeFile(staleMarkerPath, 'stale', 'utf8');
    await actualFs.utimes(lockDirectoryPath, staleTimestamp, staleTimestamp);

    const releaseProviderMetricsFileLock = await acquireProviderMetricsFileLock(metricsFilePath);

    await expect(actualFs.stat(lockDirectoryPath)).resolves.toBeDefined();
    await expect(actualFs.stat(staleMarkerPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await releaseProviderMetricsFileLock();
  });

  it('GIVEN a lock that never clears WHEN acquiring THEN times out with a ValidationError', async () => {
    const actualFs = await readActualFs();
    const metricsFilePath = await createMetricsFilePath();
    const lockDirectoryPath = `${metricsFilePath}.lock`;

    await actualFs.mkdir(lockDirectoryPath, { recursive: true });

    await expect(acquireProviderMetricsFileLock(metricsFilePath)).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Timed out waiting for provider metrics lock.',
    });
  }, 7_000);

  it('GIVEN an unexpected mkdir error WHEN acquiring THEN wraps it in a ValidationError', async () => {
    const actualFs = await readActualFs();
    let mkdirCallCount = 0;

    vi.mocked(fs.mkdir).mockImplementation(async (targetPath, options) => {
      mkdirCallCount += 1;

      if (mkdirCallCount === 1) {
        return actualFs.mkdir(targetPath, options);
      }

      throw createSystemError('EACCES', 'permission denied');
    });

    await expect(acquireProviderMetricsFileLock('/tmp/provider-metrics.json')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Unable to acquire provider metrics lock: permission denied',
    });
  });

  it('GIVEN an unexpected stat error WHEN checking a held lock THEN wraps it in a ValidationError', async () => {
    const actualFs = await readActualFs();
    let mkdirCallCount = 0;

    vi.mocked(fs.mkdir).mockImplementation(async (targetPath, options) => {
      mkdirCallCount += 1;

      if (mkdirCallCount === 1) {
        return actualFs.mkdir(targetPath, options);
      }

      throw createSystemError('EEXIST', 'already exists');
    });
    vi.mocked(fs.stat).mockRejectedValue(createSystemError('EACCES', 'permission denied'));

    await expect(acquireProviderMetricsFileLock('/tmp/provider-metrics.json')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Unable to inspect provider metrics lock: permission denied',
    });
  });
});
