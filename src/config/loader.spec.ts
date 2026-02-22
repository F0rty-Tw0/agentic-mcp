import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from './loader.ts';
import type { ProvidersFile } from '../shared/common/index.ts';

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-mcp-loader-'));

  tempDirs.push(dir);

  return dir;
};

const buildProvider = (
  overrides: Partial<ProvidersFile['providers'][string]> = {}
): ProvidersFile['providers'][string] => ({
  enabled: true,
  description: 'Loader test provider',
  command: 'test-cli',
  timeout: 120000,
  env: {},
  outputFormat: 'json',
  commands: {
    ask: {
      args: ['run'],
    },
  },
  input: {
    method: 'positional',
  },
  ...overrides,
});

const buildConfig = (
  providerName: string,
  providerOverrides: Partial<ProvidersFile['providers'][string]> = {}
): ProvidersFile => ({
  configVersion: 1,
  providers: {
    [providerName]: buildProvider(providerOverrides),
  },
});

const writeConfig = async (dir: string, fileName: string, config: ProvidersFile): Promise<string> => {
  const filePath = path.join(dir, fileName);
  const content = JSON.stringify(config, null, 2);

  await fs.writeFile(filePath, content, 'utf8');

  return filePath;
};

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();

  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

describe('loadConfig', () => {
  it('GIVEN explicit config path WHEN env path is also set THEN explicit config is loaded', async () => {
    const tempDir = await createTempDir();
    const explicitPath = await writeConfig(tempDir, 'explicit.json', buildConfig('explicit'));
    const envPath = await writeConfig(tempDir, 'env.json', buildConfig('env'));

    vi.stubEnv('AGENTIC_MCP_CONFIG', envPath);

    const loaded = await loadConfig({ configPath: explicitPath });

    expect(loaded.providers.explicit).toBeDefined();
    expect(loaded.providers.env).toBeUndefined();
  });

  it('GIVEN env config path WHEN loading without explicit path THEN env config is loaded', async () => {
    const tempDir = await createTempDir();
    const envPath = await writeConfig(tempDir, 'env.json', buildConfig('env'));
    const appDataDir = await createTempDir();
    const userLocalDir = path.join(appDataDir, 'agentic-mcp');

    await fs.mkdir(userLocalDir, { recursive: true });
    await writeConfig(userLocalDir, 'providers.json', buildConfig('user-local'));

    vi.stubEnv('AGENTIC_MCP_CONFIG', envPath);
    vi.stubEnv('APPDATA', appDataDir);

    const loaded = await loadConfig();

    expect(loaded.providers.env).toBeDefined();
    expect(loaded.providers['user-local']).toBeUndefined();
  });

  it('GIVEN user-local config WHEN explicit and env paths are absent THEN user-local config is loaded', async () => {
    const appDataDir = await createTempDir();

    let userLocalDir: string;

    if (process.platform === 'win32') {
      userLocalDir = path.join(appDataDir, 'agentic-mcp');
      vi.stubEnv('APPDATA', appDataDir);
    } else {
      userLocalDir = path.join(appDataDir, '.config', 'agentic-mcp');
      vi.spyOn(os, 'homedir').mockReturnValue(appDataDir);
    }

    await fs.mkdir(userLocalDir, { recursive: true });
    await writeConfig(userLocalDir, 'providers.json', buildConfig('user-local'));

    vi.stubEnv('AGENTIC_MCP_CONFIG', '');

    const loaded = await loadConfig();

    expect(loaded.providers['user-local']).toBeDefined();
  });

  it('GIVEN no explicit env or user-local config WHEN loading THEN bundled config is used', async () => {
    const appDataDir = await createTempDir();

    vi.stubEnv('AGENTIC_MCP_CONFIG', '');
    vi.stubEnv('APPDATA', appDataDir);

    const loaded = await loadConfig();

    expect(loaded.providers.claude).toBeDefined();
  });

  it('GIVEN dangerous auto-mode flags WHEN loading THEN a warning is written to stderr', async () => {
    const tempDir = await createTempDir();
    const configPath = await writeConfig(
      tempDir,
      'dangerous.json',
      buildConfig('unsafe', {
        commands: {
          ask: {
            args: ['run'],
            flags: {
              autoMode: ['--full-auto'],
            },
          },
        },
      })
    );

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await loadConfig({ configPath });

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: provider "unsafe" uses dangerous auto-mode flag "--full-auto"')
    );
  });
});
