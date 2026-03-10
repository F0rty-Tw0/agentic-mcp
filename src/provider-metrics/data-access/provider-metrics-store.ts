import process from 'node:process';

import { nowIso } from '../../shared';
import type { ProviderCallRecord, ProviderMetricsSummary } from '../common';
import { appendProviderCallRecord, loadProviderMetricsFile } from './provider-metrics-file.util';
import { buildProviderMetricsSummary } from './provider-metrics-summary.builder';

const buildWarningMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const warningMessage = `Warning: failed to persist provider metrics: ${message}`;

  return warningMessage;
};

export const recordCall = async (provider: string, executionTimeMs: number, success: boolean): Promise<void> => {
  const providerCallRecord: ProviderCallRecord = {
    provider,
    executionTimeMs,
    success,
    calledAt: nowIso(),
  };

  try {
    await appendProviderCallRecord(providerCallRecord);
  } catch (error: unknown) {
    const warningMessage = buildWarningMessage(error);

    process.stderr.write(`${warningMessage}\n`);
  }
};

export const getProviderMetrics = async (): Promise<ProviderMetricsSummary> => {
  const providerMetricsFile = await loadProviderMetricsFile();
  const providerMetricsSummary = buildProviderMetricsSummary(providerMetricsFile);

  return providerMetricsSummary;
};

export { resetProviderMetricsStoreForTests } from './provider-metrics-file.util';
