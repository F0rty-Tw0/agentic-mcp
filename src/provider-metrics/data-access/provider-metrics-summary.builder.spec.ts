import { describe, expect, it } from 'vitest';

import type { ProviderCallRecord, ProviderMetricsFile } from '../common';
import { buildProviderMetricsSummary } from './provider-metrics-summary.builder';

const createRecord = (
  input: Readonly<{
    provider: string;
    executionTimeMs: number;
    success: boolean;
    calledAt: string;
  }>
): ProviderCallRecord => {
  const record: ProviderCallRecord = {
    provider: input.provider,
    executionTimeMs: input.executionTimeMs,
    success: input.success,
    calledAt: input.calledAt,
  };

  return record;
};

const createMetricsFile = (records: readonly ProviderCallRecord[]): ProviderMetricsFile => {
  const providerMetricsFile: ProviderMetricsFile = {
    collectedSince: '2026-01-01T00:00:00.000Z',
    records,
  };

  return providerMetricsFile;
};

describe('buildProviderMetricsSummary', () => {
  it('GIVEN no records WHEN building the summary THEN returns zero calls and no providers', () => {
    const providerMetricsFile = createMetricsFile([]);

    const result = buildProviderMetricsSummary(providerMetricsFile);

    expect(result).toStrictEqual({
      collectedSince: '2026-01-01T00:00:00.000Z',
      totalCalls: 0,
      providers: [],
    });
  });

  it('GIVEN records from multiple providers WHEN building the summary THEN aggregates counts and timings per provider', () => {
    const providerMetricsFile = createMetricsFile([
      createRecord({
        provider: 'claude',
        executionTimeMs: 101,
        success: true,
        calledAt: '2026-01-01T00:01:00.000Z',
      }),
      createRecord({
        provider: 'codex',
        executionTimeMs: 40,
        success: false,
        calledAt: '2026-01-01T00:02:00.000Z',
      }),
      createRecord({
        provider: 'claude',
        executionTimeMs: 200,
        success: false,
        calledAt: '2026-01-01T00:03:00.000Z',
      }),
    ]);

    const result = buildProviderMetricsSummary(providerMetricsFile);

    expect(result).toStrictEqual({
      collectedSince: '2026-01-01T00:00:00.000Z',
      totalCalls: 3,
      providers: [
        {
          provider: 'claude',
          totalCalls: 2,
          successCount: 1,
          failureCount: 1,
          totalExecutionTimeMs: 301,
          avgExecutionTimeMs: 151,
          lastCallAt: '2026-01-01T00:03:00.000Z',
        },
        {
          provider: 'codex',
          totalCalls: 1,
          successCount: 0,
          failureCount: 1,
          totalExecutionTimeMs: 40,
          avgExecutionTimeMs: 40,
          lastCallAt: '2026-01-01T00:02:00.000Z',
        },
      ],
    });
  });

  it('GIVEN records for one provider WHEN building the summary THEN rounds the average execution time', () => {
    const providerMetricsFile = createMetricsFile([
      createRecord({
        provider: 'gemini',
        executionTimeMs: 100,
        success: true,
        calledAt: '2026-01-01T00:01:00.000Z',
      }),
      createRecord({
        provider: 'gemini',
        executionTimeMs: 101,
        success: true,
        calledAt: '2026-01-01T00:02:00.000Z',
      }),
    ]);

    const result = buildProviderMetricsSummary(providerMetricsFile);

    expect(result.providers[0]).toStrictEqual({
      provider: 'gemini',
      totalCalls: 2,
      successCount: 2,
      failureCount: 0,
      totalExecutionTimeMs: 201,
      avgExecutionTimeMs: 101,
      lastCallAt: '2026-01-01T00:02:00.000Z',
    });
  });
});
