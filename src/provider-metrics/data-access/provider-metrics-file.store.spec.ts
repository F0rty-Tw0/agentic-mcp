import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProviderCallRecord, ProviderMetricsFile } from '../common';
import { parseProviderMetricsFile } from './provider-metrics-file.schema';
import {
  appendProviderCallRecord,
  loadProviderMetricsFile,
  resetProviderMetricsStoreForTests,
} from './provider-metrics-file.store';

type FsModule = typeof fs;

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<FsModule>();

  return {
    ...actual,
    mkdir: vi.fn(actual.mkdir),
    readFile: vi.fn(actual.readFile),
    readdir: vi.fn(actual.readdir),
    rename: vi.fn(actual.rename),
    rm: vi.fn(actual.rm),
    stat: vi.fn(actual.stat),
    writeFile: vi.fn(actual.writeFile),
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
  vi.mocked(fs.readFile).mockReset();
  vi.mocked(fs.readFile).mockImplementation(actual.readFile);
  vi.mocked(fs.readdir).mockReset();
  vi.mocked(fs.readdir).mockImplementation(actual.readdir);
  vi.mocked(fs.rename).mockReset();
  vi.mocked(fs.rename).mockImplementation(actual.rename);
  vi.mocked(fs.rm).mockReset();
  vi.mocked(fs.rm).mockImplementation(actual.rm);
  vi.mocked(fs.stat).mockReset();
  vi.mocked(fs.stat).mockImplementation(actual.stat);
  vi.mocked(fs.writeFile).mockReset();
  vi.mocked(fs.writeFile).mockImplementation(actual.writeFile);
};

const createTempDir = async (): Promise<string> => {
  const actualFs = await readActualFs();
  const directoryPath = await actualFs.mkdtemp(path.join(os.tmpdir(), 'agentic-mcp-provider-metrics-file-store-'));

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
  const actualFs = await readActualFs();
  const content = await actualFs.readFile(metricsFilePath, 'utf8');
  const providerMetricsFile = parseProviderMetricsFile(content);

  return providerMetricsFile;
};

const createSystemError = (code: string, message: string): NodeJS.ErrnoException => {
  const systemError = new Error(message) as NodeJS.ErrnoException;

  systemError.code = code;

  return systemError;
};

beforeEach(async () => {
  await resetFsMocks();
});

afterEach(async () => {
  const actualFs = await readActualFs();

  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();

  for (const directoryPath of tempDirs) {
    await actualFs.rm(directoryPath, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

describe('loadProviderMetricsFile', () => {
  it('GIVEN no persisted file WHEN loading metrics THEN returns an empty metrics file', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T10:00:00.000Z'));
    const metricsFilePath = await configureMetricsPath();

    const result = await loadProviderMetricsFile();

    expect(result).toStrictEqual({
      collectedSince: '2026-02-01T10:00:00.000Z',
      records: [],
    });
    await expect(readPersistedMetricsFile(metricsFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('GIVEN a persisted metrics file WHEN loading metrics THEN returns the parsed metrics file', async () => {
    const actualFs = await readActualFs();
    const metricsFilePath = await configureMetricsPath();
    const persistedMetricsFile: ProviderMetricsFile = {
      collectedSince: '2026-01-01T00:00:00.000Z',
      records: [createProviderCallRecord()],
    };

    await actualFs.mkdir(path.dirname(metricsFilePath), { recursive: true });
    await actualFs.writeFile(metricsFilePath, JSON.stringify(persistedMetricsFile, null, 2), 'utf8');

    const result = await loadProviderMetricsFile();

    expect(result).toStrictEqual(persistedMetricsFile);
  });

  it('GIVEN an unexpected read error WHEN loading metrics THEN throws a ValidationError', async () => {
    await configureMetricsPath();
    vi.mocked(fs.readFile).mockRejectedValueOnce(createSystemError('EACCES', 'permission denied'));

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

    await appendProviderCallRecord(providerCallRecord);

    const result = await loadProviderMetricsFile();
    const persistedMetricsFile = await readPersistedMetricsFile(metricsFilePath);

    expect(result.records).toStrictEqual([providerCallRecord]);
    expect(persistedMetricsFile.records).toStrictEqual([providerCallRecord]);
  });

  it('GIVEN invalid persisted JSON WHEN appending a record THEN the store recovers with a fresh metrics file', async () => {
    const actualFs = await readActualFs();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-02T09:00:00.000Z'));

    const metricsFilePath = await configureMetricsPath();
    const providerCallRecord = createProviderCallRecord();

    await actualFs.mkdir(path.dirname(metricsFilePath), { recursive: true });
    await actualFs.writeFile(metricsFilePath, '{"records":[]}garbage', 'utf8');
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
    const actualFs = await readActualFs();
    const metricsFilePath = await configureMetricsPath();
    const tempFilePath = `${metricsFilePath}.123.tmp`;
    const lockDirectoryPath = `${metricsFilePath}.lock`;
    const unrelatedFilePath = `${metricsFilePath}.keep`;

    await actualFs.mkdir(path.dirname(metricsFilePath), { recursive: true });
    await actualFs.writeFile(metricsFilePath, '{}', 'utf8');
    await actualFs.writeFile(tempFilePath, 'temp', 'utf8');
    await actualFs.writeFile(unrelatedFilePath, 'keep', 'utf8');
    await actualFs.mkdir(lockDirectoryPath, { recursive: true });

    await resetProviderMetricsStoreForTests();

    await expect(actualFs.stat(metricsFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(actualFs.stat(tempFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(actualFs.stat(lockDirectoryPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(actualFs.readFile(unrelatedFilePath, 'utf8')).resolves.toBe('keep');
  });

  it('GIVEN an unexpected temp-file cleanup error WHEN reset THEN throws a ValidationError', async () => {
    await configureMetricsPath();
    vi.mocked(fs.readdir).mockRejectedValueOnce(createSystemError('EACCES', 'permission denied'));

    await expect(resetProviderMetricsStoreForTests()).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Unable to clean provider metrics temp files: permission denied',
    });
  });
});
