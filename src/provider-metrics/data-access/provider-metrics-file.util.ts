import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ValidationError } from '../../shared';
import type { ProviderCallRecord, ProviderMetricsFile } from '../common';
import { acquireProviderMetricsFileLock } from './provider-metrics-lock.util';
import { createEmptyProviderMetricsFile, parseProviderMetricsFile } from './provider-metrics-parser.util';
import { resolveProviderMetricsFilePath } from './provider-metrics-path.util';
import { MAX_METRIC_RECORDS } from '../common/provider-metrics.const';

const TEMP_FILE_SUFFIX = '.tmp';

const isSystemError = (error: unknown): error is NodeJS.ErrnoException => {
  const result = error instanceof Error && 'code' in error;

  return result;
};

const buildTempFilePath = (metricsFilePath: string): string => {
  const tempFilePath = `${metricsFilePath}.${randomUUID()}${TEMP_FILE_SUFFIX}`;

  return tempFilePath;
};

const writeProviderMetricsFile = async (
  metricsFilePath: string,
  providerMetricsFile: ProviderMetricsFile
): Promise<void> => {
  const tempFilePath = buildTempFilePath(metricsFilePath);
  const content = JSON.stringify(providerMetricsFile, null, 2);

  await mkdir(path.dirname(metricsFilePath), { recursive: true });
  await writeFile(tempFilePath, content, { encoding: 'utf8', flush: true });
  await rename(tempFilePath, metricsFilePath);
};

const limitRecords = (records: readonly ProviderCallRecord[]): readonly ProviderCallRecord[] => {
  const limitedRecords = records.slice(-MAX_METRIC_RECORDS);

  return limitedRecords;
};

const buildUpdatedMetricsFile = (
  providerMetricsFile: ProviderMetricsFile,
  record: ProviderCallRecord
): ProviderMetricsFile => {
  const records = limitRecords([...providerMetricsFile.records, record]);
  const updatedProviderMetricsFile: ProviderMetricsFile = {
    collectedSince: providerMetricsFile.collectedSince,
    records,
  };

  return updatedProviderMetricsFile;
};

const readMetricsFile = async (metricsFilePath: string): Promise<ProviderMetricsFile> => {
  try {
    const content = await readFile(metricsFilePath, 'utf8');
    const providerMetricsFile = parseProviderMetricsFile(content);

    return providerMetricsFile;
  } catch (error: unknown) {
    if (error instanceof ValidationError) throw error;

    if (isSystemError(error) && error.code === 'ENOENT') {
      return createEmptyProviderMetricsFile();
    }

    const message = error instanceof Error ? error.message : 'Unknown read error';

    throw new ValidationError(`Unable to read provider metrics: ${message}`);
  }
};

const removeTempFiles = async (metricsFilePath: string): Promise<void> => {
  const directoryPath = path.dirname(metricsFilePath);
  const fileNamePrefix = `${path.basename(metricsFilePath)}.`;

  try {
    const directoryEntries = await readdir(directoryPath);

    await Promise.all(
      directoryEntries
        .filter((entry) => entry.startsWith(fileNamePrefix) && entry.endsWith(TEMP_FILE_SUFFIX))
        .map(async (entry) => rm(path.join(directoryPath, entry), { force: true }))
    );
  } catch (error: unknown) {
    if (isSystemError(error) && error.code === 'ENOENT') return;

    const message = error instanceof Error ? error.message : 'Unknown readdir error';

    throw new ValidationError(`Unable to clean provider metrics temp files: ${message}`);
  }
};

const readMetricsFileForAppend = async (metricsFilePath: string): Promise<ProviderMetricsFile> => {
  try {
    const providerMetricsFile = await readMetricsFile(metricsFilePath);

    return providerMetricsFile;
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return createEmptyProviderMetricsFile();
    }

    throw error;
  }
};

export const loadProviderMetricsFile = async (): Promise<ProviderMetricsFile> => {
  const metricsFilePath = resolveProviderMetricsFilePath();
  const providerMetricsFile = await readMetricsFile(metricsFilePath);

  return providerMetricsFile;
};

export const appendProviderCallRecord = async (record: ProviderCallRecord): Promise<void> => {
  const metricsFilePath = resolveProviderMetricsFilePath();
  const releaseProviderMetricsFileLock = await acquireProviderMetricsFileLock(metricsFilePath);

  try {
    const providerMetricsFile = await readMetricsFileForAppend(metricsFilePath);
    const updatedProviderMetricsFile = buildUpdatedMetricsFile(providerMetricsFile, record);

    await writeProviderMetricsFile(metricsFilePath, updatedProviderMetricsFile);
  } finally {
    await releaseProviderMetricsFileLock();
  }
};

export const resetProviderMetricsStoreForTests = async (): Promise<void> => {
  const metricsFilePath = resolveProviderMetricsFilePath();

  await rm(metricsFilePath, { force: true });
  await rm(`${metricsFilePath}.lock`, { force: true, recursive: true });
  await removeTempFiles(metricsFilePath);
};
