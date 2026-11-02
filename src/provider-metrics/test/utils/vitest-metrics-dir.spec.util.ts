import { rm } from 'node:fs/promises';
import path from 'node:path';

const VITEST_METRICS_DIR_PATTERN = /^agentic-mcp-vitest-\d+$/;

// Vitest types config.env as always set, but it is undefined at runtime when the config sets no env.
type MetricsProjectConfig = {
  readonly env?: Partial<NodeJS.ProcessEnv>;
};

type MetricsProject = {
  readonly config: MetricsProjectConfig;
};

type RemoveMetricsDir = () => Promise<void>;

const resolveVitestMetricsDir = (project: MetricsProject): string | undefined => {
  const metricsPath = project.config.env?.AGENTIC_MCP_METRICS_PATH;

  if (metricsPath == null) return undefined;

  const metricsDir = path.dirname(metricsPath);
  const isVitestMetricsDir = VITEST_METRICS_DIR_PATTERN.test(path.basename(metricsDir));
  const result = isVitestMetricsDir ? metricsDir : undefined;

  return result;
};

// Vitest globalSetup: the per-run metrics dir the config points at is removed once the run ends.
// Only an agentic-mcp-vitest-<pid> dir is removed, so a config pointed at real metrics never deletes them.
export const setup = (project: MetricsProject): RemoveMetricsDir => {
  const metricsDir = resolveVitestMetricsDir(project);

  const removeMetricsDir: RemoveMetricsDir = async () => {
    if (metricsDir === undefined) return;

    await rm(metricsDir, { recursive: true, force: true });
  };

  return removeMetricsDir;
};
