import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProviderMetrics, recordCall } from './provider-metrics-store';
import type { ProviderCallRecord, ProviderMetricsFile, ProviderMetricsSummary } from '../common';

type AppendProviderCallRecord = (record: ProviderCallRecord) => Promise<void>;
type LoadProviderMetricsFile = () => Promise<ProviderMetricsFile>;
type BuildProviderMetricsSummary = (providerMetricsFile: ProviderMetricsFile) => ProviderMetricsSummary;
type ResetProviderMetricsStoreForTests = () => Promise<void>;
type NowIso = () => string;

const providerMetricsStoreMocks = vi.hoisted(() => ({
  nowIso: vi.fn<NowIso>(),
  appendProviderCallRecord: vi.fn<AppendProviderCallRecord>(),
  loadProviderMetricsFile: vi.fn<LoadProviderMetricsFile>(),
  buildProviderMetricsSummary: vi.fn<BuildProviderMetricsSummary>(),
  resetProviderMetricsStoreForTests: vi.fn<ResetProviderMetricsStoreForTests>(),
}));

vi.mock('../../shared', () => ({
  nowIso: providerMetricsStoreMocks.nowIso,
}));

vi.mock('./provider-metrics-file.util', () => ({
  appendProviderCallRecord: providerMetricsStoreMocks.appendProviderCallRecord,
  loadProviderMetricsFile: providerMetricsStoreMocks.loadProviderMetricsFile,
  resetProviderMetricsStoreForTests: providerMetricsStoreMocks.resetProviderMetricsStoreForTests,
}));

vi.mock('./provider-metrics-summary.builder', () => ({
  buildProviderMetricsSummary: providerMetricsStoreMocks.buildProviderMetricsSummary,
}));

const createProviderCallRecord = (): ProviderCallRecord => {
  const providerCallRecord: ProviderCallRecord = {
    provider: 'claude',
    executionTimeMs: 10,
    success: true,
    calledAt: '2026-01-01T00:01:00.000Z',
  };

  return providerCallRecord;
};

const createProviderMetricsFile = (): ProviderMetricsFile => {
  const providerMetricsFile: ProviderMetricsFile = {
    collectedSince: '2026-01-01T00:00:00.000Z',
    records: [createProviderCallRecord()],
  };

  return providerMetricsFile;
};

const createProviderMetricsSummary = (providerMetricsFile: ProviderMetricsFile): ProviderMetricsSummary => {
  const providerMetricsSummary: ProviderMetricsSummary = {
    collectedSince: providerMetricsFile.collectedSince,
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

  return providerMetricsSummary;
};

const resetProviderMetricsStoreMocks = (): void => {
  providerMetricsStoreMocks.nowIso.mockReset();
  providerMetricsStoreMocks.appendProviderCallRecord.mockReset();
  providerMetricsStoreMocks.loadProviderMetricsFile.mockReset();
  providerMetricsStoreMocks.buildProviderMetricsSummary.mockReset();
  providerMetricsStoreMocks.resetProviderMetricsStoreForTests.mockReset();
};

const configureDefaultMocks = (): void => {
  providerMetricsStoreMocks.nowIso.mockReturnValue('2026-03-10T00:00:00.000Z');
  providerMetricsStoreMocks.appendProviderCallRecord.mockImplementation(async () => {
    await Promise.resolve();
  });
  providerMetricsStoreMocks.loadProviderMetricsFile.mockImplementation(async () => {
    const providerMetricsFile = await Promise.resolve(createProviderMetricsFile());

    return providerMetricsFile;
  });
  providerMetricsStoreMocks.buildProviderMetricsSummary.mockImplementation((providerMetricsFile) => {
    const providerMetricsSummary = createProviderMetricsSummary(providerMetricsFile);

    return providerMetricsSummary;
  });
  providerMetricsStoreMocks.resetProviderMetricsStoreForTests.mockImplementation(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  resetProviderMetricsStoreMocks();
  configureDefaultMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('provider-metrics-store warning handling', () => {
  it('GIVEN persistence fails with an Error WHEN recording a call THEN writes the warning with the error message', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const appendProviderCallRecord = vi.fn<AppendProviderCallRecord>(async () => {
      const error = await Promise.resolve(new Error('disk full'));

      throw error;
    });

    providerMetricsStoreMocks.appendProviderCallRecord.mockImplementation(appendProviderCallRecord);

    await recordCall('gemini', 250, false);

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
    const appendProviderCallRecord = vi.fn<AppendProviderCallRecord>(async () => {
      const rawFailure = await Promise.resolve('raw failure');

      return Promise.reject(rawFailure);
    });

    providerMetricsStoreMocks.appendProviderCallRecord.mockImplementation(appendProviderCallRecord);

    await recordCall('gemini', 250, false);

    expect(stderrSpy).toHaveBeenCalledWith('Warning: failed to persist provider metrics: Unknown error\n');
  });

  it('GIVEN a loaded metrics file WHEN querying metrics THEN delegates to the summary builder', async () => {
    const providerMetricsFile = createProviderMetricsFile();
    const providerMetricsSummary = createProviderMetricsSummary(providerMetricsFile);
    const loadProviderMetricsFile = vi.fn<LoadProviderMetricsFile>(async () => {
      const loadedProviderMetricsFile = await Promise.resolve(providerMetricsFile);

      return loadedProviderMetricsFile;
    });
    const buildProviderMetricsSummary = vi.fn<BuildProviderMetricsSummary>((loadedProviderMetricsFile) => {
      expect(loadedProviderMetricsFile).toStrictEqual(providerMetricsFile);

      return providerMetricsSummary;
    });

    providerMetricsStoreMocks.loadProviderMetricsFile.mockImplementation(loadProviderMetricsFile);
    providerMetricsStoreMocks.buildProviderMetricsSummary.mockImplementation(buildProviderMetricsSummary);

    const result = await getProviderMetrics();

    expect(loadProviderMetricsFile).toHaveBeenCalledOnce();
    expect(buildProviderMetricsSummary).toHaveBeenCalledOnce();
    expect(result).toStrictEqual(providerMetricsSummary);
  });
});
