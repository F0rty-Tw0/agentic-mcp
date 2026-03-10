import { ValidationError, nowIso } from '../../shared';
import type { ProviderCallRecord, ProviderMetricsFile } from '../common';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  const result = typeof value === 'object' && value !== null && !Array.isArray(value);

  return result;
};

export const createEmptyProviderMetricsFile = (): ProviderMetricsFile => {
  const providerMetricsFile: ProviderMetricsFile = {
    collectedSince: nowIso(),
    records: [],
  };

  return providerMetricsFile;
};

const parseProviderCallRecord = (value: unknown): ProviderCallRecord => {
  if (!isRecord(value)) {
    throw new ValidationError('Stored provider metrics records must be objects.');
  }

  const { calledAt, executionTimeMs, provider, success } = value;

  if (
    typeof provider !== 'string' ||
    typeof executionTimeMs !== 'number' ||
    typeof success !== 'boolean' ||
    typeof calledAt !== 'string'
  ) {
    throw new ValidationError('Stored provider metrics records are invalid.');
  }

  const record: ProviderCallRecord = {
    provider,
    executionTimeMs,
    success,
    calledAt,
  };

  return record;
};

const readCollectedSince = (value: Readonly<Record<string, unknown>>): string => {
  const collectedSince = value.collectedSince;

  if (typeof collectedSince !== 'string') {
    throw new ValidationError('Stored provider metrics must include string key "collectedSince".');
  }

  return collectedSince;
};

const readRecords = (value: Readonly<Record<string, unknown>>): readonly ProviderCallRecord[] => {
  const records = value.records;

  if (!Array.isArray(records)) {
    throw new ValidationError('Stored provider metrics must include array key "records".');
  }

  const parsedRecords = records.map((record) => parseProviderCallRecord(record));

  return parsedRecords;
};

export const parseProviderMetricsFile = (content: string): ProviderMetricsFile => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';

    throw new ValidationError(`Stored provider metrics are invalid JSON: ${message}`);
  }

  if (!isRecord(parsed)) {
    throw new ValidationError('Stored provider metrics root must be an object.');
  }

  const providerMetricsFile: ProviderMetricsFile = {
    collectedSince: readCollectedSince(parsed),
    records: readRecords(parsed),
  };

  return providerMetricsFile;
};
