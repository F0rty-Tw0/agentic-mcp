import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recordCall, resetProviderMetricsStoreForTests } from './provider-metrics-store';

type PersistedMetricsRecords = Readonly<{
  records: readonly unknown[];
}>;

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-mcp-provider-metrics-'));

  tempDirs.push(dir);

  return dir;
};

const isNonArrayObject = (value: unknown): value is Readonly<Record<string, unknown>> => {
  const result = typeof value === 'object' && value !== null && !Array.isArray(value);

  return result;
};

const isPersistedMetricsRecords = (value: unknown): value is PersistedMetricsRecords => {
  if (!isNonArrayObject(value)) return false;

  const result = Array.isArray(value.records);

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

describe('provider-metrics-store path resolution', () => {
  beforeEach(async () => {
    const homeDir = await createTempDir();

    vi.stubEnv('AGENTIC_MCP_METRICS_PATH', '');
    vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
    vi.stubEnv('XDG_STATE_HOME', '');
    vi.stubEnv('APPDATA', '');
    vi.stubEnv('LOCALAPPDATA', '');
    await resetProviderMetricsStoreForTests();
  });

  afterEach(async () => {
    await resetProviderMetricsStoreForTests();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();

    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
  });

  it('GIVEN win32 and LOCALAPPDATA WHEN recording a call THEN metrics are written under LOCALAPPDATA', async () => {
    const localAppDataDir = await createTempDir();

    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.stubEnv('LOCALAPPDATA', localAppDataDir);
    await recordCall('claude', 100, true);

    const metricsFilePath = path.join(localAppDataDir, 'agentic-mcp', 'provider-metrics.json');
    const persistedMetricsRecords = await readPersistedMetricsRecords(metricsFilePath);

    expect(persistedMetricsRecords.records).toHaveLength(1);
  });

  it('GIVEN darwin WHEN recording a call THEN metrics are written under Library Application Support', async () => {
    const homeDir = await createTempDir();

    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
    await recordCall('claude', 100, true);

    const metricsFilePath = path.join(
      homeDir,
      'Library',
      'Application Support',
      'agentic-mcp',
      'provider-metrics.json'
    );
    const persistedMetricsRecords = await readPersistedMetricsRecords(metricsFilePath);

    expect(persistedMetricsRecords.records).toHaveLength(1);
  });

  it('GIVEN linux and XDG_STATE_HOME WHEN recording a call THEN metrics are written under XDG_STATE_HOME', async () => {
    const xdgStateHome = await createTempDir();

    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.stubEnv('XDG_STATE_HOME', xdgStateHome);
    await recordCall('claude', 100, true);

    const metricsFilePath = path.join(xdgStateHome, 'agentic-mcp', 'provider-metrics.json');
    const persistedMetricsRecords = await readPersistedMetricsRecords(metricsFilePath);

    expect(persistedMetricsRecords.records).toHaveLength(1);
  });

  it('GIVEN AGENTIC_MCP_METRICS_PATH WHEN recording a call THEN override path wins over platform defaults', async () => {
    const overrideDir = await createTempDir();
    const overridePath = path.join(overrideDir, 'custom', 'provider-metrics.json');

    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.stubEnv('XDG_STATE_HOME', await createTempDir());
    vi.stubEnv('AGENTIC_MCP_METRICS_PATH', overridePath);
    await recordCall('claude', 100, true);

    const persistedMetricsRecords = await readPersistedMetricsRecords(overridePath);

    expect(persistedMetricsRecords.records).toHaveLength(1);
  });

  it('GIVEN linux without XDG_STATE_HOME WHEN recording a call THEN metrics are written under local state fallback', async () => {
    const homeDir = await createTempDir();

    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
    await recordCall('claude', 100, true);

    const metricsFilePath = path.join(homeDir, '.local', 'state', 'agentic-mcp', 'provider-metrics.json');
    const persistedMetricsRecords = await readPersistedMetricsRecords(metricsFilePath);

    expect(persistedMetricsRecords.records).toHaveLength(1);
  });
});
