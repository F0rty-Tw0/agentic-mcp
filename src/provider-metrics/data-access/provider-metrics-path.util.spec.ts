import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveProviderMetricsFilePath } from './provider-metrics-path.util';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('resolveProviderMetricsFilePath', () => {
  it('GIVEN AGENTIC_MCP_METRICS_PATH WHEN resolved THEN the absolute override path wins', () => {
    vi.stubEnv('AGENTIC_MCP_METRICS_PATH', './custom/provider-metrics.json');

    const result = resolveProviderMetricsFilePath();

    expect(result).toBe(path.resolve('./custom/provider-metrics.json'));
  });

  it('GIVEN win32 and LOCALAPPDATA WHEN resolved THEN returns the LOCALAPPDATA metrics path', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.stubEnv('AGENTIC_MCP_METRICS_PATH', '');
    vi.stubEnv('LOCALAPPDATA', 'C:\\Users\\tester\\AppData\\Local');

    const result = resolveProviderMetricsFilePath();

    expect(result).toBe(path.join('C:\\Users\\tester\\AppData\\Local', 'agentic-mcp', 'provider-metrics.json'));
  });

  it('GIVEN win32 without LOCALAPPDATA WHEN resolved THEN falls back to the homedir AppData path', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\tester');
    vi.stubEnv('AGENTIC_MCP_METRICS_PATH', '');
    vi.stubEnv('LOCALAPPDATA', '');

    const result = resolveProviderMetricsFilePath();

    expect(result).toBe(path.join('C:\\Users\\tester', 'AppData', 'Local', 'agentic-mcp', 'provider-metrics.json'));
  });

  it('GIVEN darwin WHEN resolved THEN returns the Library Application Support path', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/tester');
    vi.stubEnv('AGENTIC_MCP_METRICS_PATH', '');

    const result = resolveProviderMetricsFilePath();

    expect(result).toBe(
      path.join('/Users/tester', 'Library', 'Application Support', 'agentic-mcp', 'provider-metrics.json')
    );
  });

  it('GIVEN linux and XDG_STATE_HOME WHEN resolved THEN returns the XDG state path', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.stubEnv('AGENTIC_MCP_METRICS_PATH', '');
    vi.stubEnv('XDG_STATE_HOME', '/tmp/xdg-state');

    const result = resolveProviderMetricsFilePath();

    expect(result).toBe(path.join('/tmp/xdg-state', 'agentic-mcp', 'provider-metrics.json'));
  });

  it('GIVEN linux without XDG_STATE_HOME WHEN resolved THEN falls back to the local state directory', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.spyOn(os, 'homedir').mockReturnValue('/home/tester');
    vi.stubEnv('AGENTIC_MCP_METRICS_PATH', '');
    vi.stubEnv('XDG_STATE_HOME', '');

    const result = resolveProviderMetricsFilePath();

    expect(result).toBe(path.join('/home/tester', '.local', 'state', 'agentic-mcp', 'provider-metrics.json'));
  });
});
