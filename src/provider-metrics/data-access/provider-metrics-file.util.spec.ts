import fs from 'node:fs/promises';
import type * as fsPromisesModuleTypes from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderCallRecord, ProviderMetricsFile } from '../common';
import type * as providerMetricsFileUtilModuleTypes from './provider-metrics-file.util';
import { parseProviderMetricsFile } from './provider-metrics-parser.util';

type FsModule = typeof fsPromisesModuleTypes;
type ProviderMetricsFileUtilModule = typeof providerMetricsFileUtilModuleTypes;

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const directoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-mcp-provider-metrics-file-util-'));

  tempDirs.push(directoryPath);

  return directoryPath;
};

const configureMetricsPath = async (): Promise<string> => {
  const directoryPath = await createTempDir();
  const metricsFilePath = path.join(directoryPath, 'state', 'provider-metrics.json');

  vi.stubEnv('AGENTIC_MCP_METRICS_PATH', metricsFilePath);

  return metricsFilePath;
};

const createProviderCallRecord = (): ProviderCallRecord => {
  const providerCallRecord: ProviderCallRecord = {
    provider: 'claude',
    executionTimeMs: 123,
    success: true,
    calledAt: '2026-01-01T00:01:00.000Z',
  };

  return providerCallRecord;
};

const readPersistedMetricsFile = async (metricsFilePath: string): Promise<ProviderMetricsFile> => {
  const content = await fs.readFile(metricsFilePath, 'utf8');
  const providerMetricsFile = parseProviderMetricsFile(content);

  return providerMetricsFile;
};

const createSystemError = (code: string, message: string): NodeJS.ErrnoException => {
  const systemError = new Error(message) as NodeJS.ErrnoException;

  systemError.code = code;

  return systemError;
};

const loadProviderMetricsFileUtilModule = async (
  fsOverrides: Partial<FsModule> = {}
): Promise<ProviderMetricsFileUtilModule> => {
  vi.resetModules();
  vi.doMock('node:fs/promises', async () => {
    const actualFsModule = await vi.importActual<FsModule>('node:fs/promises');
    const mockedFsModule = { ...actualFsModule, ...fsOverrides };

    return mockedFsModule;
  });

  const providerMetricsFileUtilModule = await import('./provider-metrics-file.util');

  vi.doUnmock('node:fs/promises');

  return providerMetricsFileUtilModule;
};

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.resetModules();

  for (const directoryPath of tempDirs) {
    await fs.rm(directoryPath, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

describe('loadProviderMetricsFile', () => {
  it('GIVEN no persisted file WHEN loading metrics THEN returns an empty metrics file', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T10:00:00.000Z'));

    const metricsFilePath = await configureMetricsPath();
    const { loadProviderMetricsFile } = await loadProviderMetricsFileUtilModule();

    const result = await loadProviderMetricsFile();

    expect(result).toStrictEqual({
      collectedSince: '2026-02-01T10:00:00.000Z',
      records: [],
    });
    await expect(fs.stat(metricsFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('GIVEN a persisted metrics file WHEN loading metrics THEN returns the parsed metrics file', async () => {
    const metricsFilePath = await configureMetricsPath();
    const persistedMetricsFile: ProviderMetricsFile = {
      collectedSince: '2026-01-01T00:00:00.000Z',
      records: [createProviderCallRecord()],
    };

    await fs.mkdir(path.dirname(metricsFilePath), { recursive: true });
    await fs.writeFile(metricsFilePath, JSON.stringify(persistedMetricsFile, null, 2), 'utf8');

    const { loadProviderMetricsFile } = await loadProviderMetricsFileUtilModule();
    const result = await loadProviderMetricsFile();

    expect(result).toStrictEqual(persistedMetricsFile);
  });

  it('GIVEN an unexpected read error WHEN loading metrics THEN throws a ValidationError', async () => {
    await configureMetricsPath();

    const { loadProviderMetricsFile } = await loadProviderMetricsFileUtilModule({
      readFile: vi.fn(async () => {
        const error = await Promise.resolve(createSystemError('EACCES', 'permission denied'));

        throw error;
      }),
    });

    await expect(loadProviderMetricsFile()).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Unable to read provider metrics: permission denied',
    });
  });
});

describe('appendProviderCallRecord', () => {
  it('GIVEN a provider call record WHEN appended THEN it persists the record to disk', async () => {
    const metricsFilePath = await configureMetricsPath();
    const providerCallRecord = createProviderCallRecord();
    const { appendProviderCallRecord, loadProviderMetricsFile } = await loadProviderMetricsFileUtilModule();

    await appendProviderCallRecord(providerCallRecord);

    const result = await loadProviderMetricsFile();
    const persistedMetricsFile = await readPersistedMetricsFile(metricsFilePath);

    expect(result.records).toStrictEqual([providerCallRecord]);
    expect(persistedMetricsFile.records).toStrictEqual([providerCallRecord]);
  });

  it('GIVEN invalid persisted JSON WHEN appending a record THEN the store recovers with a fresh metrics file', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-02T09:00:00.000Z'));

    const metricsFilePath = await configureMetricsPath();
    const providerCallRecord = createProviderCallRecord();
    const { appendProviderCallRecord, loadProviderMetricsFile } = await loadProviderMetricsFileUtilModule();

    await fs.mkdir(path.dirname(metricsFilePath), { recursive: true });
    await fs.writeFile(metricsFilePath, '{"records":[]}garbage', 'utf8');
    await appendProviderCallRecord(providerCallRecord);

    const result = await loadProviderMetricsFile();

    expect(result).toStrictEqual({
      collectedSince: '2026-02-02T09:00:00.000Z',
      records: [providerCallRecord],
    });
  });
});

describe('resetProviderMetricsStoreForTests', () => {
  it('GIVEN metrics, temp files, and a lock directory WHEN reset THEN it removes provider metrics artifacts only', async () => {
    const metricsFilePath = await configureMetricsPath();
    const tempFilePath = `${metricsFilePath}.123.tmp`;
    const lockDirectoryPath = `${metricsFilePath}.lock`;
    const unrelatedFilePath = `${metricsFilePath}.keep`;
    const { resetProviderMetricsStoreForTests } = await loadProviderMetricsFileUtilModule();

    await fs.mkdir(path.dirname(metricsFilePath), { recursive: true });
    await fs.writeFile(metricsFilePath, '{}', 'utf8');
    await fs.writeFile(tempFilePath, 'temp', 'utf8');
    await fs.writeFile(unrelatedFilePath, 'keep', 'utf8');
    await fs.mkdir(lockDirectoryPath, { recursive: true });

    await resetProviderMetricsStoreForTests();

    await expect(fs.stat(metricsFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.stat(tempFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.stat(lockDirectoryPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.readFile(unrelatedFilePath, 'utf8')).resolves.toBe('keep');
  });

  it('GIVEN an unexpected temp-file cleanup error WHEN reset THEN throws a ValidationError', async () => {
    await configureMetricsPath();

    const { resetProviderMetricsStoreForTests } = await loadProviderMetricsFileUtilModule({
      readdir: vi.fn(async () => {
        const error = await Promise.resolve(createSystemError('EACCES', 'permission denied'));

        throw error;
      }),
    });

    await expect(resetProviderMetricsStoreForTests()).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Unable to clean provider metrics temp files: permission denied',
    });
  });
});
