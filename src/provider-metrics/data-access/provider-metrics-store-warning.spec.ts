import process from 'node:process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderCallRecord, ProviderMetricsSummary } from '../common';
import type * as providerMetricsFileUtilModuleTypes from './provider-metrics-file.util';
import type * as providerMetricsSummaryBuilderModuleTypes from './provider-metrics-summary.builder';
import type * as sharedModuleTypes from '../../shared';

type AppendProviderCallRecord = (record: ProviderCallRecord) => Promise<void>;
type LoadProviderMetricsFile = () => Promise<unknown>;
type BuildProviderMetricsSummary = (providerMetricsFile: unknown) => ProviderMetricsSummary;
type ProviderMetricsStoreUnderTest = Readonly<{
  recordCall: (provider: string, executionTimeMs: number, success: boolean) => Promise<void>;
  getProviderMetrics: () => Promise<ProviderMetricsSummary>;
}>;
type LoadProviderMetricsStoreInput = Readonly<{
  appendProviderCallRecord?: AppendProviderCallRecord;
  loadProviderMetricsFile?: LoadProviderMetricsFile;
  buildProviderMetricsSummary?: BuildProviderMetricsSummary;
  nowIso?: string;
}>;

const loadProviderMetricsStoreModule = async (
  input: LoadProviderMetricsStoreInput = {}
): Promise<ProviderMetricsStoreUnderTest> => {
  vi.resetModules();
  vi.doMock('../../shared', async () => {
    const actualShared = await vi.importActual<typeof sharedModuleTypes>('../../shared');
    const mockedShared = {
      ...actualShared,
      nowIso: (): string => input.nowIso ?? '2026-03-10T00:00:00.000Z',
    };

    return mockedShared;
  });
  vi.doMock('./provider-metrics-file.util', async () => {
    const actualProviderMetricsFileUtil =
      await vi.importActual<typeof providerMetricsFileUtilModuleTypes>('./provider-metrics-file.util');
    const mockedProviderMetricsFileUtil = {
      ...actualProviderMetricsFileUtil,
      appendProviderCallRecord:
        input.appendProviderCallRecord ?? actualProviderMetricsFileUtil.appendProviderCallRecord,
      loadProviderMetricsFile: input.loadProviderMetricsFile ?? actualProviderMetricsFileUtil.loadProviderMetricsFile,
    };

    return mockedProviderMetricsFileUtil;
  });
  vi.doMock('./provider-metrics-summary.builder', async () => {
    const actualProviderMetricsSummaryBuilder = await vi.importActual<typeof providerMetricsSummaryBuilderModuleTypes>(
      './provider-metrics-summary.builder'
    );
    const mockedProviderMetricsSummaryBuilder = {
      ...actualProviderMetricsSummaryBuilder,
      buildProviderMetricsSummary:
        input.buildProviderMetricsSummary ?? actualProviderMetricsSummaryBuilder.buildProviderMetricsSummary,
    };

    return mockedProviderMetricsSummaryBuilder;
  });

  const providerMetricsStoreModule = await import('./provider-metrics-store');
  const providerMetricsStoreUnderTest: ProviderMetricsStoreUnderTest = {
    recordCall: providerMetricsStoreModule.recordCall,
    getProviderMetrics: providerMetricsStoreModule.getProviderMetrics,
  };

  vi.doUnmock('../../shared');
  vi.doUnmock('./provider-metrics-file.util');
  vi.doUnmock('./provider-metrics-summary.builder');

  return providerMetricsStoreUnderTest;
};

const createProviderCallRecord = (): ProviderCallRecord => {
  const providerCallRecord: ProviderCallRecord = {
    provider: 'claude',
    executionTimeMs: 10,
    success: true,
    calledAt: '2026-01-01T00:01:00.000Z',
  };

  return providerCallRecord;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('provider-metrics-store warning handling', () => {
  it('GIVEN persistence fails with an Error WHEN recording a call THEN writes the warning with the error message', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const appendProviderCallRecord = vi.fn(async () => {
      const error = await Promise.resolve(new Error('disk full'));

      throw error;
    });
    const { recordCall: storeRecordCall } = await loadProviderMetricsStoreModule({
      appendProviderCallRecord,
      nowIso: '2026-03-10T00:00:00.000Z',
    });

    await storeRecordCall('gemini', 250, false);

    expect(appendProviderCallRecord).toHaveBeenCalledWith({
      provider: 'gemini',
      executionTimeMs: 250,
      success: false,
      calledAt: '2026-03-10T00:00:00.000Z',
    });
    expect(stderrSpy).toHaveBeenCalledWith('Warning: failed to persist provider metrics: disk full\n');
  });

  it('GIVEN persistence fails with a non-Error WHEN recording a call THEN writes an unknown error warning', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const appendProviderCallRecord = vi.fn(async () => {
      const rawFailure = await Promise.resolve('raw failure');

      return Promise.reject(rawFailure);
    });
    const { recordCall: storeRecordCall } = await loadProviderMetricsStoreModule({
      appendProviderCallRecord,
      nowIso: '2026-03-10T00:00:00.000Z',
    });

    await storeRecordCall('gemini', 250, false);

    expect(stderrSpy).toHaveBeenCalledWith('Warning: failed to persist provider metrics: Unknown error\n');
  });

  it('GIVEN a loaded metrics file WHEN querying metrics THEN delegates to the summary builder', async () => {
    const providerMetricsFile = {
      collectedSince: '2026-01-01T00:00:00.000Z',
      records: [createProviderCallRecord()],
    };
    const providerMetricsSummary: ProviderMetricsSummary = {
      collectedSince: '2026-01-01T00:00:00.000Z',
      totalCalls: 1,
      providers: [
        {
          provider: 'claude',
          totalCalls: 1,
          successCount: 1,
          failureCount: 0,
          totalExecutionTimeMs: 10,
          avgExecutionTimeMs: 10,
          lastCallAt: '2026-01-01T00:01:00.000Z',
        },
      ],
    };
    const loadProviderMetricsFile = vi.fn(async () => {
      const loadedProviderMetricsFile = await Promise.resolve(providerMetricsFile);

      return loadedProviderMetricsFile;
    });
    const buildProviderMetricsSummary = vi.fn((loadedProviderMetricsFile: unknown) => {
      expect(loadedProviderMetricsFile).toStrictEqual(providerMetricsFile);

      return providerMetricsSummary;
    });
    const { getProviderMetrics: storeGetProviderMetrics } = await loadProviderMetricsStoreModule({
      loadProviderMetricsFile,
      buildProviderMetricsSummary,
    });

    const result = await storeGetProviderMetrics();

    expect(loadProviderMetricsFile).toHaveBeenCalledOnce();
    expect(buildProviderMetricsSummary).toHaveBeenCalledOnce();
    expect(result).toStrictEqual(providerMetricsSummary);
  });
});
