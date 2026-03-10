import type { ProviderCallRecord, ProviderMetricsFile, ProviderMetricsSummary, ProviderStats } from '../common';

type ProviderStatsAccumulator = Readonly<{
  provider: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  totalExecutionTimeMs: number;
  lastCallAt: string;
}>;

const createProviderStatsAccumulator = (record: ProviderCallRecord): ProviderStatsAccumulator => {
  const providerStatsAccumulator: ProviderStatsAccumulator = {
    provider: record.provider,
    totalCalls: 1,
    successCount: record.success ? 1 : 0,
    failureCount: record.success ? 0 : 1,
    totalExecutionTimeMs: record.executionTimeMs,
    lastCallAt: record.calledAt,
  };

  return providerStatsAccumulator;
};

const updateProviderStatsAccumulator = (
  providerStatsAccumulator: ProviderStatsAccumulator,
  record: ProviderCallRecord
): ProviderStatsAccumulator => {
  const updatedProviderStatsAccumulator: ProviderStatsAccumulator = {
    provider: providerStatsAccumulator.provider,
    totalCalls: providerStatsAccumulator.totalCalls + 1,
    successCount: providerStatsAccumulator.successCount + (record.success ? 1 : 0),
    failureCount: providerStatsAccumulator.failureCount + (record.success ? 0 : 1),
    totalExecutionTimeMs: providerStatsAccumulator.totalExecutionTimeMs + record.executionTimeMs,
    lastCallAt: record.calledAt,
  };

  return updatedProviderStatsAccumulator;
};

const toProviderStats = (providerStatsAccumulator: ProviderStatsAccumulator): ProviderStats => {
  const avgExecutionTimeMs = Math.round(
    providerStatsAccumulator.totalExecutionTimeMs / providerStatsAccumulator.totalCalls
  );
  const providerStats: ProviderStats = {
    provider: providerStatsAccumulator.provider,
    totalCalls: providerStatsAccumulator.totalCalls,
    successCount: providerStatsAccumulator.successCount,
    failureCount: providerStatsAccumulator.failureCount,
    totalExecutionTimeMs: providerStatsAccumulator.totalExecutionTimeMs,
    avgExecutionTimeMs,
    lastCallAt: providerStatsAccumulator.lastCallAt,
  };

  return providerStats;
};

const buildProviderStats = (records: readonly ProviderCallRecord[]): readonly ProviderStats[] => {
  const accumulators = new Map<string, ProviderStatsAccumulator>();

  for (const record of records) {
    const providerStatsAccumulator = accumulators.get(record.provider);

    if (providerStatsAccumulator == null) {
      const nextProviderStatsAccumulator = createProviderStatsAccumulator(record);

      accumulators.set(record.provider, nextProviderStatsAccumulator);
      continue;
    }

    const nextProviderStatsAccumulator = updateProviderStatsAccumulator(providerStatsAccumulator, record);

    accumulators.set(record.provider, nextProviderStatsAccumulator);
  }

  const providerStats = Array.from(accumulators.values()).map((providerStatsAccumulator) =>
    toProviderStats(providerStatsAccumulator)
  );

  return providerStats;
};

export const buildProviderMetricsSummary = (providerMetricsFile: ProviderMetricsFile): ProviderMetricsSummary => {
  const providers = buildProviderStats(providerMetricsFile.records);
  const providerMetricsSummary: ProviderMetricsSummary = {
    collectedSince: providerMetricsFile.collectedSince,
    totalCalls: providerMetricsFile.records.length,
    providers,
  };

  return providerMetricsSummary;
};
