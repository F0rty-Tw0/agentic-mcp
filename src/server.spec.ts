import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProvidersFile } from './common/provider-config.types.ts';
import type { ResolvedProvider } from './domain-logic/handlers/meta.ts';
import type { ResolvedProviderEntry } from './domain-logic/tool-registry.ts';
import { createServer } from './server.ts';
import type { AsyncViFn, SyncViFn } from './test-utils/vi-fn.types.ts';

type LoadConfigMock = AsyncViFn<[options?: { configPath?: string }], ProvidersFile>;

type ResolveCliBinaryMock = AsyncViFn<[command: string], string | null>;

type RegisterAllToolsMock = SyncViFn<[server: McpServer, resolvedProviders: ResolvedProviderEntry[], allProviders: ResolvedProvider[]], void>;

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

vi.mock('./config/loader.ts', () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock('./utils/platform.ts', () => ({
  resolveCliBinary: mocks.resolveCliBinary,
}));

vi.mock('./domain-logic/tool-registry.ts', () => ({
  registerAllTools: mocks.registerAllTools,
}));

const buildProvider = (overrides: Partial<ProvidersFile['providers'][string]> = {}): ProvidersFile['providers'][string] => ({
  enabled: true,
  description: 'Server test provider',
  command: 'test-cli',
  defaultModel: 'test-model',
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
      ],
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
      ],
    );
  });
});
