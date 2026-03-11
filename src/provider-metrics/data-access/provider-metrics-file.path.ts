import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const METRICS_DIRECTORY_NAME = 'agentic-mcp';
const METRICS_FILE_NAME = 'provider-metrics.json';

const resolveOverrideMetricsPath = (): string | undefined => {
  const overridePath = process.env.AGENTIC_MCP_METRICS_PATH;

  if (overridePath == null || overridePath === '') return undefined;

  const metricsPath = path.resolve(overridePath);

  return metricsPath;
};

const resolveWindowsMetricsDirectory = (): string => {
  const localAppData = process.env.LOCALAPPDATA;

  if (localAppData != null && localAppData !== '') {
    return path.join(localAppData, METRICS_DIRECTORY_NAME);
  }

  const metricsDirectory = path.join(os.homedir(), 'AppData', 'Local', METRICS_DIRECTORY_NAME);

  return metricsDirectory;
};

const resolveLinuxMetricsDirectory = (): string => {
  const xdgStateHome = process.env.XDG_STATE_HOME;

  if (xdgStateHome != null && xdgStateHome !== '') {
    return path.join(xdgStateHome, METRICS_DIRECTORY_NAME);
  }

  const metricsDirectory = path.join(os.homedir(), '.local', 'state', METRICS_DIRECTORY_NAME);

  return metricsDirectory;
};

const resolveMetricsDirectory = (): string => {
  if (process.platform === 'win32') return resolveWindowsMetricsDirectory();

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', METRICS_DIRECTORY_NAME);
  }

  return resolveLinuxMetricsDirectory();
};

export const resolveProviderMetricsFilePath = (): string => {
  const overrideMetricsPath = resolveOverrideMetricsPath();

  if (overrideMetricsPath != null) return overrideMetricsPath;

  const metricsFilePath = path.join(resolveMetricsDirectory(), METRICS_FILE_NAME);

  return metricsFilePath;
};
