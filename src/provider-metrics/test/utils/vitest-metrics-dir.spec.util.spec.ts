import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setup } from './vitest-metrics-dir.spec.util';

const buildProject = (metricsPath: string | undefined): Parameters<typeof setup>[0] => {
  const env = { ['AGENTIC_MCP_METRICS_PATH']: metricsPath };
  const config = { env };
  const project = { config };

  return project;
};

describe('FEATURE: vitest metrics dir teardown', () => {
  let parentDir: string;

  beforeEach(async () => {
    parentDir = await mkdtemp(path.join(os.tmpdir(), 'agentic-metrics-dir-'));
  });

  afterEach(async () => {
    await rm(parentDir, { recursive: true, force: true });
  });

  describe('GIVEN the metrics path sits in an agentic-mcp-vitest-<pid> dir', () => {
    it('WHEN the teardown runs THEN the dir is removed', async () => {
      const metricsDir = path.join(parentDir, 'agentic-mcp-vitest-123');
      const project = buildProject(path.join(metricsDir, 'provider-metrics.json'));

      await mkdir(metricsDir);

      const removeMetricsDir = setup(project);

      await removeMetricsDir();
      const dirExists = existsSync(metricsDir);

      expect(dirExists).toBe(false);
    });
  });

  describe('GIVEN the metrics path sits in a dir with another name', () => {
    it('WHEN the teardown runs THEN the dir is kept', async () => {
      const metricsDir = path.join(parentDir, 'agentic-mcp');
      const project = buildProject(path.join(metricsDir, 'provider-metrics.json'));

      await mkdir(metricsDir);

      const removeMetricsDir = setup(project);

      await removeMetricsDir();
      const dirExists = existsSync(metricsDir);

      expect(dirExists).toBe(true);
    });
  });

  describe('GIVEN a config without an env', () => {
    it('WHEN the teardown runs THEN the parent dir is kept', async () => {
      const project = { config: {} };
      const removeMetricsDir = setup(project);

      await removeMetricsDir();
      const dirExists = existsSync(parentDir);

      expect(dirExists).toBe(true);
    });
  });

  describe('GIVEN no metrics path in the config env', () => {
    it('WHEN the teardown runs THEN the parent dir is kept', async () => {
      const project = buildProject(undefined);
      const removeMetricsDir = setup(project);

      await removeMetricsDir();
      const dirExists = existsSync(parentDir);

      expect(dirExists).toBe(true);
    });
  });
});
