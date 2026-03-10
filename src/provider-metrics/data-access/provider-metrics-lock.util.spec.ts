import fs from 'node:fs/promises';
import type * as fsPromisesModuleTypes from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as providerMetricsLockUtilModuleTypes from './provider-metrics-lock.util';

type FsModule = typeof fsPromisesModuleTypes;
type ProviderMetricsLockUtilModule = typeof providerMetricsLockUtilModuleTypes;

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const directoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-mcp-provider-metrics-lock-'));

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

const loadProviderMetricsLockUtilModule = async (
  fsOverrides: Partial<FsModule> = {}
): Promise<ProviderMetricsLockUtilModule> => {
  vi.resetModules();
  vi.doMock('node:fs/promises', async () => {
    const actualFsModule = await vi.importActual<FsModule>('node:fs/promises');
    const mockedFsModule = { ...actualFsModule, ...fsOverrides };

    return mockedFsModule;
  });

  const providerMetricsLockUtilModule = await import('./provider-metrics-lock.util');

  vi.doUnmock('node:fs/promises');

  return providerMetricsLockUtilModule;
};

const removeDirectory = async (directoryPath: string): Promise<void> => {
  await fs.rm(directoryPath, { recursive: true, force: true });
};

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.resetModules();

  for (const directoryPath of tempDirs) {
    await fs.rm(directoryPath, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

describe('acquireProviderMetricsFileLock', () => {
  it('GIVEN an unlocked metrics file WHEN acquiring and releasing THEN creates and removes the lock directory', async () => {
    const metricsFilePath = await createMetricsFilePath();
    const lockDirectoryPath = `${metricsFilePath}.lock`;
    const { acquireProviderMetricsFileLock } = await loadProviderMetricsLockUtilModule();

    const releaseProviderMetricsFileLock = await acquireProviderMetricsFileLock(metricsFilePath);

    await expect(fs.stat(lockDirectoryPath)).resolves.toBeDefined();
    await releaseProviderMetricsFileLock();
    await expect(fs.stat(lockDirectoryPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('GIVEN an existing lock directory WHEN it clears shortly after THEN waits and acquires the lock', async () => {
    const metricsFilePath = await createMetricsFilePath();
    const lockDirectoryPath = `${metricsFilePath}.lock`;
    const { acquireProviderMetricsFileLock } = await loadProviderMetricsLockUtilModule();

    await fs.mkdir(lockDirectoryPath, { recursive: true });
    setTimeout(() => {
      void removeDirectory(lockDirectoryPath);
    }, 25);

    const releaseProviderMetricsFileLock = await acquireProviderMetricsFileLock(metricsFilePath);

    await expect(fs.stat(lockDirectoryPath)).resolves.toBeDefined();
    await releaseProviderMetricsFileLock();
  });

  it('GIVEN a stale lock directory WHEN acquiring the lock THEN removes the stale directory before re-locking', async () => {
    const metricsFilePath = await createMetricsFilePath();
    const lockDirectoryPath = `${metricsFilePath}.lock`;
    const staleMarkerPath = path.join(lockDirectoryPath, 'stale.txt');
    const staleTimestamp = new Date(Date.now() - 31_000);
    const { acquireProviderMetricsFileLock } = await loadProviderMetricsLockUtilModule();

    await fs.mkdir(lockDirectoryPath, { recursive: true });
    await fs.writeFile(staleMarkerPath, 'stale', 'utf8');
    await fs.utimes(lockDirectoryPath, staleTimestamp, staleTimestamp);

    const releaseProviderMetricsFileLock = await acquireProviderMetricsFileLock(metricsFilePath);

    await expect(fs.stat(lockDirectoryPath)).resolves.toBeDefined();
    await expect(fs.stat(staleMarkerPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await releaseProviderMetricsFileLock();
  });

  it('GIVEN a lock that never clears WHEN acquiring THEN times out with a ValidationError', async () => {
    const metricsFilePath = await createMetricsFilePath();
    const lockDirectoryPath = `${metricsFilePath}.lock`;
    const { acquireProviderMetricsFileLock } = await loadProviderMetricsLockUtilModule();

    await fs.mkdir(lockDirectoryPath, { recursive: true });

    await expect(acquireProviderMetricsFileLock(metricsFilePath)).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Timed out waiting for provider metrics lock.',
    });
  }, 7_000);

  it('GIVEN an unexpected mkdir error WHEN acquiring THEN wraps it in a ValidationError', async () => {
    let mkdirCallCount = 0;
    const mkdirMock = vi.fn(async () => {
      const callCount = await Promise.resolve(mkdirCallCount + 1);

      mkdirCallCount = callCount;

      if (mkdirCallCount === 1) return undefined;

      throw createSystemError('EACCES', 'permission denied');
    });
    const { acquireProviderMetricsFileLock } = await loadProviderMetricsLockUtilModule({ mkdir: mkdirMock });

    const acquireLock = async (): Promise<void> => {
      await acquireProviderMetricsFileLock('/tmp/provider-metrics.json');
    };

    await expect(acquireLock()).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Unable to acquire provider metrics lock: permission denied',
    });
  });

  it('GIVEN an unexpected stat error WHEN checking a held lock THEN wraps it in a ValidationError', async () => {
    let mkdirCallCount = 0;
    const mkdirMock = vi.fn(async () => {
      const callCount = await Promise.resolve(mkdirCallCount + 1);

      mkdirCallCount = callCount;

      if (mkdirCallCount === 1) return undefined;

      throw createSystemError('EEXIST', 'already exists');
    });
    const { acquireProviderMetricsFileLock } = await loadProviderMetricsLockUtilModule({
      mkdir: mkdirMock,
      stat: vi.fn(async () => {
        const error = await Promise.resolve(createSystemError('EACCES', 'permission denied'));

        throw error;
      }),
    });

    const acquireLock = async (): Promise<void> => {
      await acquireProviderMetricsFileLock('/tmp/provider-metrics.json');
    };

    await expect(acquireLock()).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Unable to inspect provider metrics lock: permission denied',
    });
  });
});
