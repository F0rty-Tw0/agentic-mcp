import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_METRIC_RECORDS } from '../common';
import type { ProviderCallRecord } from '../common';
import { getProviderMetrics, recordCall, resetProviderMetricsStoreForTests } from './provider-metrics-store';

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-mcp-provider-metrics-'));

  tempDirs.push(dir);

  return dir;
};

const configureMetricsHome = (homeDir: string): void => {
  vi.stubEnv('AGENTIC_MCP_METRICS_PATH', '');

  if (process.platform === 'win32') {
    vi.stubEnv('APPDATA', '');
    vi.stubEnv('LOCALAPPDATA', homeDir);

    return;
  }

  vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
  vi.stubEnv('XDG_STATE_HOME', '');
};

let metricsHomeDir = '';

type PersistedMetricsRecords = Readonly<{
  records: readonly ProviderCallRecord[];
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  const result = typeof value === 'object' && value !== null && !Array.isArray(value);

  return result;
};

const resolveOverrideMetricsFilePath = (): string | undefined => {
  const overridePath = process.env.AGENTIC_MCP_METRICS_PATH;

  if (overridePath == null || overridePath === '') return undefined;

  const metricsFilePath = path.resolve(overridePath);

  return metricsFilePath;
};

const resolveLinuxMetricsFilePath = (homeDir: string): string => {
  const xdgStateHome = process.env.XDG_STATE_HOME;

  if (xdgStateHome != null && xdgStateHome !== '') {
    return path.join(xdgStateHome, 'agentic-mcp', 'provider-metrics.json');
  }

  const metricsFilePath = path.join(homeDir, '.local', 'state', 'agentic-mcp', 'provider-metrics.json');

  return metricsFilePath;
};

const resolveDefaultMetricsFilePath = (homeDir: string): string => {
  if (process.platform === 'win32') {
    return path.join(homeDir, 'agentic-mcp', 'provider-metrics.json');
  }

  if (process.platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'agentic-mcp', 'provider-metrics.json');
  }

  const metricsFilePath = resolveLinuxMetricsFilePath(homeDir);

  return metricsFilePath;
};

const resolveMetricsFilePath = (homeDir: string): string => {
  const overrideMetricsFilePath = resolveOverrideMetricsFilePath();

  if (overrideMetricsFilePath != null) return overrideMetricsFilePath;

  const metricsFilePath = resolveDefaultMetricsFilePath(homeDir);

  return metricsFilePath;
};

const createPersistedRecord = function (provider: string, calledAt: string): ProviderCallRecord {
  const record: ProviderCallRecord = {
    provider,
    executionTimeMs: 10,
    success: true,
    calledAt,
  };

  return record;
};

const createPersistedRecords = (provider: string, count: number): readonly ProviderCallRecord[] => {
  const records: ProviderCallRecord[] = [];

  for (let index = 0; index < count; index++) {
    const record = createPersistedRecord(provider, '2026-01-01T00:00:00.000Z');

    records.push(record);
  }

  return records;
};

const isPersistedMetricsRecords = (value: unknown): value is PersistedMetricsRecords => {
  if (!isRecord(value)) return false;

  const { records } = value;
  const result = Array.isArray(records);

  return result;
};

const parsePersistedMetricsRecords = (content: string): PersistedMetricsRecords => {
  const parsed: unknown = JSON.parse(content);

  if (!isPersistedMetricsRecords(parsed)) {
    throw new Error('Persisted metrics file must include a records array.');
  }

  return parsed;
};

const readPersistedMetricsRecords = async (metricsFilePath: string): Promise<PersistedMetricsRecords> => {
  const content = await fs.readFile(metricsFilePath, 'utf8');
  const persistedMetricsRecords = parsePersistedMetricsRecords(content);

  return persistedMetricsRecords;
};

const writeMetricsFile = async (records: readonly ProviderCallRecord[]): Promise<void> => {
  const metricsFilePath = resolveMetricsFilePath(metricsHomeDir);
  const content = JSON.stringify(
    {
      collectedSince: '2026-01-01T00:00:00.000Z',
      records,
    },
    null,
    2
  );

  await fs.mkdir(path.dirname(metricsFilePath), { recursive: true });
  await fs.writeFile(metricsFilePath, content, 'utf8');
};

describe('provider-metrics-store', () => {
  beforeEach(async () => {
    metricsHomeDir = await createTempDir();

    configureMetricsHome(metricsHomeDir);
    await resetProviderMetricsStoreForTests();
  });

  afterEach(async () => {
    await resetProviderMetricsStoreForTests();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();

    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
  });

  describe('recordCall', () => {
    it('GIVEN invalid persisted metrics file WHEN recording a call THEN the store recovers without warning spam', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const metricsFilePath = resolveMetricsFilePath(metricsHomeDir);

      await fs.mkdir(path.dirname(metricsFilePath), { recursive: true });
      await fs.writeFile(metricsFilePath, '{"collectedSince":"2026-01-01T00:00:00.000Z","records":[]}garbage', 'utf8');

      await recordCall('claude', 100, true);

      const summary = await getProviderMetrics();

      expect(stderrSpy).not.toHaveBeenCalled();
      expect(summary.totalCalls).toBe(1);
      expect(summary.providers[0]?.provider).toBe('claude');
    });

    it('GIVEN a provider call WHEN recorded THEN getProviderMetrics includes that provider', async () => {
      await recordCall('claude', 500, true);

      const summary = await getProviderMetrics();

      expect(summary.providers).toHaveLength(1);
      expect(summary.providers[0]?.provider).toBe('claude');
    });

    it('GIVEN a successful call WHEN recorded THEN successCount is 1 and failureCount is 0', async () => {
      await recordCall('claude', 100, true);

      const summary = await getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.successCount).toBe(1);
      expect(stats?.failureCount).toBe(0);
    });

    it('GIVEN a failed call WHEN recorded THEN failureCount is 1 and successCount is 0', async () => {
      await recordCall('claude', 100, false);

      const summary = await getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.successCount).toBe(0);
      expect(stats?.failureCount).toBe(1);
    });

    it('GIVEN multiple calls WHEN recorded THEN totalCalls reflects count', async () => {
      await recordCall('claude', 100, true);
      await recordCall('claude', 200, true);
      await recordCall('claude', 300, false);

      const summary = await getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.totalCalls).toBe(3);
    });

    it('GIVEN a recorded call WHEN reading the persisted metrics file THEN the record is written to disk', async () => {
      await recordCall('claude', 100, true);

      const metricsFilePath = resolveMetricsFilePath(metricsHomeDir);
      const persistedMetricsRecords = await readPersistedMetricsRecords(metricsFilePath);

      expect(persistedMetricsRecords.records).toHaveLength(1);
      expect(persistedMetricsRecords.records[0]?.provider).toBe('claude');
    });

    it('GIVEN existing persisted metrics WHEN recording another call THEN totals include the earlier invocation', async () => {
      const records = createPersistedRecords('claude', 1);

      await writeMetricsFile(records);
      await recordCall('codex', 200, false);

      const summary = await getProviderMetrics();
      const providers = summary.providers.map((provider) => provider.provider);

      expect(summary.totalCalls).toBe(2);
      expect(providers).toContain('claude');
      expect(providers).toContain('codex');
    });
  });

  it('GIVEN concurrent record calls WHEN persistence runs THEN all calls are stored without warnings', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const writes = Array.from({ length: 20 }, async (_, index) => {
      await recordCall('claude', index, true);
    });

    await Promise.all(writes);

    const summary = await getProviderMetrics();

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(summary.totalCalls).toBe(20);
  });

  describe('getProviderMetrics', () => {
    it('GIVEN no calls WHEN queried THEN returns empty providers and totalCalls 0', async () => {
      const summary = await getProviderMetrics();

      expect(summary.totalCalls).toBe(0);
      expect(summary.providers).toHaveLength(0);
    });

    it('GIVEN one call WHEN queried THEN totalCalls is 1', async () => {
      await recordCall('claude', 100, true);

      const summary = await getProviderMetrics();

      expect(summary.totalCalls).toBe(1);
    });

    it('GIVEN calls to two providers WHEN queried THEN returns stats for both', async () => {
      await recordCall('claude', 100, true);
      await recordCall('codex', 200, false);

      const summary = await getProviderMetrics();
      const providers = summary.providers.map((provider) => provider.provider);

      expect(summary.providers).toHaveLength(2);
      expect(summary.totalCalls).toBe(2);
      expect(providers).toContain('claude');
      expect(providers).toContain('codex');
    });

    it('GIVEN multiple calls WHEN queried THEN avgExecutionTimeMs is correct', async () => {
      await recordCall('claude', 100, true);
      await recordCall('claude', 300, true);

      const summary = await getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.totalExecutionTimeMs).toBe(400);
      expect(stats?.avgExecutionTimeMs).toBe(200);
    });

    it('GIVEN a call WHEN queried THEN lastCallAt is a valid ISO string', async () => {
      await recordCall('claude', 100, true);

      const summary = await getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.lastCallAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('GIVEN metrics storage is configured WHEN queried THEN metricsFilePath matches the resolved file location', async () => {
      const summary = await getProviderMetrics();

      expect(summary.metricsFilePath).toBe(resolveMetricsFilePath(metricsHomeDir));
    });

    it('GIVEN metrics tracking starts WHEN queried THEN collectedSince is a valid ISO string', async () => {
      const summary = await getProviderMetrics();

      expect(summary.collectedSince).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('MAX_METRIC_RECORDS pruning', () => {
    it('GIVEN more than MAX_METRIC_RECORDS calls WHEN recorded THEN store does not exceed limit', async () => {
      const records = createPersistedRecords('claude', MAX_METRIC_RECORDS);

      await writeMetricsFile(records);
      await recordCall('claude', 10, true);

      const summary = await getProviderMetrics();

      expect(summary.totalCalls).toBe(MAX_METRIC_RECORDS);
    });

    it('GIVEN pruning removes the only record for a provider WHEN recorded THEN that provider is removed from the summary', async () => {
      const newestRecords = createPersistedRecords('newest', MAX_METRIC_RECORDS - 1);
      const oldestRecord = createPersistedRecord('oldest', '2026-01-01T00:00:00.000Z');
      const records = [oldestRecord, ...newestRecords];

      await writeMetricsFile(records);
      await recordCall('newest', 10, true);

      const summary = await getProviderMetrics();
      const providers = summary.providers.map((provider) => provider.provider);

      expect(summary.totalCalls).toBe(MAX_METRIC_RECORDS);
      expect(providers).not.toContain('oldest');
      expect(providers).toContain('newest');
    });
  });
});
