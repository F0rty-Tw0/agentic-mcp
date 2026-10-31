import type { McpServer } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from './create-server';
import type { ProvidersFile, ResolvedProvider, ResolvedProviderEntry } from '../../shared';
import type { AsyncViFn, SyncViFn } from '../../shared/command-execution/test/common/vi-fn.type';

type LoadConfigOptions = { readonly configPath?: string };

type LoadConfigMock = AsyncViFn<[options?: LoadConfigOptions], ProvidersFile>;
type ResolveCliBinaryMock = AsyncViFn<[command: string], string | undefined>;
type McpServerEntry = [server: McpServer, resolvedProviders: ResolvedProviderEntry[], allProviders: ResolvedProvider[]];
type RegisterAllToolsMock = SyncViFn<McpServerEntry, void>;

const mocks = vi.hoisted(() => {
  const loadConfig = vi.fn<LoadConfigMock>();
  const resolveCliBinary = vi.fn<ResolveCliBinaryMock>();
  const registerAllTools = vi.fn<RegisterAllToolsMock>();

  const result = {
    loadConfig,
    resolveCliBinary,
    registerAllTools,
  };

  return result;
});

vi.mock('../../config/loader', () => {
  const mockedModule = {
    loadConfig: mocks.loadConfig,
    warnDangerousFlags: vi.fn(),
  };

  return mockedModule;
});

vi.mock('../../shared/command-execution/domain-logic/platform', () => {
  const mockedModule = {
    resolveCliBinary: mocks.resolveCliBinary,
    killProcess: vi.fn(),
  };

  return mockedModule;
});

vi.mock('../../tool-registry', () => {
  const mockedModule = {
    registerAllTools: mocks.registerAllTools,
  };

  return mockedModule;
});

type ProviderInput = ProvidersFile['providers'][string]['input'];

const buildProvider = (
  overrides: Partial<ProvidersFile['providers'][string]> = {}
): ProvidersFile['providers'][string] => {
  const ask = {
    args: ['run'],
  };
  const commands = {
    ask,
  };
  const input: ProviderInput = {
    method: 'positional',
  };
  const result: ProvidersFile['providers'][string] = {
    enabled: true,
    description: 'Server test provider',
    command: 'test-cli',
    timeout: 120000,
    env: {},
    outputFormat: 'json',
    commands,
    input,
    ...overrides,
  };

  return result;
};

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
    const providers = {
      available: availableProvider,
      missing: missingProvider,
      disabled: disabledProvider,
    };
    const config: ProvidersFile = {
      configVersion: 1,
      providers,
    };

    mocks.loadConfig.mockResolvedValue(config);
    mocks.resolveCliBinary.mockResolvedValueOnce('C:/bin/available-cli');
    mocks.resolveCliBinary.mockResolvedValueOnce(undefined);

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
          binaryPath: undefined,
        },
        {
          name: 'disabled',
          description: 'Disabled provider',
          enabled: false,
          available: false,
          binaryPath: undefined,
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
    const providers = {
      disabled: disabledProvider,
    };
    const config: ProvidersFile = {
      configVersion: 1,
      providers,
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
          binaryPath: undefined,
        },
      ]
    );
  });
});
