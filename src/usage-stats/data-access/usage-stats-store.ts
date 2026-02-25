import { nowIso } from '../../shared/utils';
import { MAX_USAGE_RECORDS } from '../common';
import type { ProviderCallRecord, ProviderStats, UsageSummary } from '../common';

const callsByProvider = new Map<string, ProviderCallRecord[]>();

const sessionStartedAt = nowIso();

const totalRecordCount = (): number => {
  let count = 0;

  for (const records of callsByProvider.values()) {
    count += records.length;
  }

  return count;
};

const pruneOldestRecord = (): void => {
  for (const [provider, records] of callsByProvider) {
    if (records.length > 0) {
      records.shift();

      if (records.length === 0) {
        callsByProvider.delete(provider);
      }

      return;
    }
  }
};

export const recordCall = (provider: string, executionTimeMs: number, success: boolean): void => {
  const record: ProviderCallRecord = {
    provider,
    executionTimeMs,
    success,
    calledAt: nowIso(),
  };

  const existing = callsByProvider.get(provider) ?? [];

  existing.push(record);
  callsByProvider.set(provider, existing);

  while (totalRecordCount() > MAX_USAGE_RECORDS) {
    pruneOldestRecord();
  }
};

export const getUsageSummary = (): UsageSummary => {
  let totalCalls = 0;
  const providerStats: ProviderStats[] = [];

  for (const [provider, records] of callsByProvider) {
    if (!records.length) continue;

    const successCount = records.filter((record) => record.success).length;
    const failureCount = records.length - successCount;
    const totalExecutionTimeMs = records.reduce((sum, record) => sum + record.executionTimeMs, 0);
    const avgExecutionTimeMs = Math.round(totalExecutionTimeMs / records.length);
    const lastCallAt = records.at(-1)?.calledAt ?? nowIso();

    providerStats.push({
      provider,
      totalCalls: records.length,
      successCount,
      failureCount,
      totalExecutionTimeMs,
      avgExecutionTimeMs,
      lastCallAt,
    });

    totalCalls += records.length;
  }

  return {
    sessionStartedAt,
    totalCalls,
    providers: providerStats,
  };
};

export const resetForTests = (): void => {
  callsByProvider.clear();
};
