import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from './create-server';
import type { ProvidersFile, ResolvedProvider, ResolvedProviderEntry } from '../shared/common';
import type { AsyncViFn, SyncViFn } from '../shared/common/test-utils/vi-fn.types';

type LoadConfigMock = AsyncViFn<[options?: { configPath?: string }], ProvidersFile>;

type ResolveCliBinaryMock = AsyncViFn<[command: string], string | null>;

type McpServerEntry = [server: McpServer, resolvedProviders: ResolvedProviderEntry[], allProviders: ResolvedProvider[]];

type RegisterAllToolsMock = SyncViFn<McpServerEntry, void>;

const mocks = vi.hoisted(() => {
  const loadConfig = vi.fn<LoadConfigMock>();
  const resolveCliBinary = vi.fn<ResolveCliBinaryMock>();
  const registerAllTools = vi.fn<RegisterAllToolsMock>();

  return {
    loadConfig,
    resolveCliBinary,
    registerAllTools,
  };
});

vi.mock('../config/loader', () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock('../shared/utils/platform.util', () => ({
  resolveCliBinary: mocks.resolveCliBinary,
}));

vi.mock('../tool-registry', () => ({
  registerAllTools: mocks.registerAllTools,
}));

const buildProvider = (
  overrides: Partial<ProvidersFile['providers'][string]> = {}
): ProvidersFile['providers'][string] => ({
  enabled: true,
  description: 'Server test provider',
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

describe('createServer', () => {
  beforeEach(() => {
    mocks.loadConfig.mockReset();
    mocks.resolveCliBinary.mockReset();
    mocks.registerAllTools.mockReset();
    vi.restoreAllMocks();
  });

  it('GIVEN a mixed provider set WHEN creating a server THEN it resolves only enabled binaries and registers only enabled+available providers', async () => {
    const availableProvider = buildProvider({
      description: 'Available provider',
      command: 'available-cli',
    });
    const missingProvider = buildProvider({
      description: 'Missing provider',
      command: 'missing-cli',
    });
    const disabledProvider = buildProvider({
      enabled: false,
      description: 'Disabled provider',
      command: 'disabled-cli',
    });

    const config: ProvidersFile = {
      configVersion: 1,
      providers: {
        available: availableProvider,
        missing: missingProvider,
        disabled: disabledProvider,
      },
    };

    mocks.loadConfig.mockResolvedValue(config);
    mocks.resolveCliBinary.mockResolvedValueOnce('C:/bin/available-cli');
    mocks.resolveCliBinary.mockResolvedValueOnce(null);

    const server = await createServer({
      configPath: 'custom/providers.json',
    });

    expect(mocks.loadConfig).toHaveBeenCalledWith({ configPath: 'custom/providers.json' });
    expect(mocks.resolveCliBinary).toHaveBeenCalledTimes(2);
    expect(mocks.resolveCliBinary).toHaveBeenNthCalledWith(1, 'available-cli');
    expect(mocks.resolveCliBinary).toHaveBeenNthCalledWith(2, 'missing-cli');

    expect(mocks.registerAllTools).toHaveBeenCalledTimes(1);
    expect(mocks.registerAllTools).toHaveBeenCalledWith(
      server,
      [
        {
          name: 'available',
          binaryPath: 'C:/bin/available-cli',
          config: availableProvider,
        },
      ],
      [
        {
          name: 'available',
          description: 'Available provider',
          enabled: true,
          available: true,
          binaryPath: 'C:/bin/available-cli',
        },
        {
          name: 'missing',
          description: 'Missing provider',
          enabled: true,
          available: false,
          binaryPath: null,
        },
        {
          name: 'disabled',
          description: 'Disabled provider',
          enabled: false,
          available: false,
          binaryPath: null,
        },
      ]
    );
  });

  it('GIVEN providers are disabled WHEN creating a server without options THEN it skips binary resolution and still registers provider metadata', async () => {
    const disabledProvider = buildProvider({
      enabled: false,
      description: 'Disabled provider',
      command: 'disabled-cli',
    });
    const config: ProvidersFile = {
      configVersion: 1,
      providers: {
        disabled: disabledProvider,
      },
    };

    mocks.loadConfig.mockResolvedValue(config);

    const server = await createServer();

    expect(mocks.loadConfig).toHaveBeenCalledWith(undefined);
    expect(mocks.resolveCliBinary).not.toHaveBeenCalled();
    expect(mocks.registerAllTools).toHaveBeenCalledWith(
      server,
      [],
      [
        {
          name: 'disabled',
          description: 'Disabled provider',
          enabled: false,
          available: false,
          binaryPath: null,
        },
      ]
    );
  });

  describe('zero providers warning', () => {
    it('GIVEN no providers are available WHEN creating a server THEN writes warning to stderr', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      const config: ProvidersFile = {
        configVersion: 1,
        providers: {
          missing: buildProvider({ command: 'missing-cli' }),
        },
      };

      mocks.loadConfig.mockResolvedValue(config);
      mocks.resolveCliBinary.mockResolvedValue(null);

      await createServer();

      expect(stderrSpy).toHaveBeenCalledWith(
        'Warning: no providers are available. Install at least one CLI tool (claude, codex, copilot, gemini, opencode) and restart.\n'
      );
    });

    it('GIVEN at least one provider is available WHEN creating a server THEN does not write warning to stderr', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      const config: ProvidersFile = {
        configVersion: 1,
        providers: {
          available: buildProvider({ command: 'available-cli' }),
        },
      };

      mocks.loadConfig.mockResolvedValue(config);
      mocks.resolveCliBinary.mockResolvedValue('/usr/bin/available-cli');

      await createServer();

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('GIVEN all providers are disabled WHEN creating a server THEN writes warning to stderr', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      const config: ProvidersFile = {
        configVersion: 1,
        providers: {
          disabled: buildProvider({ enabled: false, command: 'disabled-cli' }),
        },
      };

      mocks.loadConfig.mockResolvedValue(config);

      await createServer();

      expect(stderrSpy).toHaveBeenCalledWith(
        'Warning: no providers are available. Install at least one CLI tool (claude, codex, copilot, gemini, opencode) and restart.\n'
      );
    });
  });
});
