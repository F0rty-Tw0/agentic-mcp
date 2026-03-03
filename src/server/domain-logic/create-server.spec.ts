import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from './create-server';
import type { AsyncViFn, ProvidersFile, ResolvedProvider, ResolvedProviderEntry, SyncViFn } from '../../shared';

type ActiveRequest = Readonly<{ requestId: string; pid: number }>;

type LoadConfigMock = AsyncViFn<[options?: { configPath?: string }], ProvidersFile>;

type ResolveCliBinaryMock = AsyncViFn<[command: string], string | undefined>;

type KillProcessMock = AsyncViFn<[pid: number], boolean>;

type GetActiveRequestMock = SyncViFn<[requestId: string], ActiveRequest | undefined>;

type UnregisterActiveRequestMock = SyncViFn<[requestId: string], void>;

type McpServerEntry = [server: McpServer, resolvedProviders: ResolvedProviderEntry[], allProviders: ResolvedProvider[]];

type RegisterAllToolsMock = SyncViFn<McpServerEntry, void>;

const mocks = vi.hoisted(() => {
  const loadConfig = vi.fn<LoadConfigMock>();
  const resolveCliBinary = vi.fn<ResolveCliBinaryMock>();
  const killProcess = vi.fn<KillProcessMock>();
  const getActiveRequest = vi.fn<GetActiveRequestMock>();
  const unregisterActiveRequest = vi.fn<UnregisterActiveRequestMock>();
  const registerAllTools = vi.fn<RegisterAllToolsMock>();

  return {
    loadConfig,
    resolveCliBinary,
    killProcess,
    getActiveRequest,
    unregisterActiveRequest,
    registerAllTools,
  };
});

vi.mock('../../config/loader', () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock('../../shared/command-execution/utils/platform.util', () => ({
  resolveCliBinary: mocks.resolveCliBinary,
  killProcess: mocks.killProcess,
}));

vi.mock('../../shared/validation/domain-logic/request-registry', () => ({
  getActiveRequest: mocks.getActiveRequest,
  unregisterActiveRequest: mocks.unregisterActiveRequest,
}));

vi.mock('../../tool-registry', () => ({
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
    mocks.killProcess.mockReset();
    mocks.getActiveRequest.mockReset();
    mocks.unregisterActiveRequest.mockReset();
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
          binaryPath: undefined,
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
      mocks.resolveCliBinary.mockResolvedValue(undefined);

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

  describe('cancellation notification handler', () => {
    const emptyConfig: ProvidersFile = {
      configVersion: 1,
      providers: {},
    };

    type NotificationHandler = (notification: unknown) => Promise<void>;

    const createServerAndCaptureHandler = async (): Promise<NotificationHandler> => {
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      mocks.loadConfig.mockResolvedValue(emptyConfig);

      let capturedHandler: NotificationHandler | undefined;

      const originalSetHandler = Server.prototype.setNotificationHandler;

      vi.spyOn(Server.prototype, 'setNotificationHandler').mockImplementation(function (
        this: InstanceType<typeof Server>,
        schema: Parameters<typeof originalSetHandler>[0],
        handler: Parameters<typeof originalSetHandler>[1]
      ) {
        originalSetHandler.call(this, schema, handler);
        capturedHandler = handler as NotificationHandler;
      });

      await createServer();

      vi.mocked(Server.prototype.setNotificationHandler).mockRestore();

      if (!capturedHandler) throw new Error('Notification handler was not registered');

      return capturedHandler;
    };

    it('GIVEN an active request WHEN cancellation notification is received THEN it kills the process and unregisters the request', async () => {
      const handler = await createServerAndCaptureHandler();

      mocks.getActiveRequest.mockReturnValue({ requestId: '42', pid: 1234 });
      mocks.killProcess.mockResolvedValue(true);

      await handler({ params: { requestId: '42' } });

      expect(mocks.getActiveRequest).toHaveBeenCalledWith('42');
      expect(mocks.killProcess).toHaveBeenCalledWith(1234);
      expect(mocks.unregisterActiveRequest).toHaveBeenCalledWith('42');
    });

    it('GIVEN no active request for the id WHEN cancellation notification is received THEN it does not kill or unregister anything', async () => {
      const handler = await createServerAndCaptureHandler();

      mocks.getActiveRequest.mockReturnValue(undefined);

      await handler({ params: { requestId: '99' } });

      expect(mocks.getActiveRequest).toHaveBeenCalledWith('99');
      expect(mocks.killProcess).not.toHaveBeenCalled();
      expect(mocks.unregisterActiveRequest).not.toHaveBeenCalled();
    });

    it('GIVEN a numeric requestId WHEN cancellation notification is received THEN it converts to string and processes correctly', async () => {
      const handler = await createServerAndCaptureHandler();

      mocks.getActiveRequest.mockReturnValue({ requestId: '7', pid: 5678 });
      mocks.killProcess.mockResolvedValue(true);

      await handler({ params: { requestId: 7 } });

      expect(mocks.getActiveRequest).toHaveBeenCalledWith('7');
      expect(mocks.killProcess).toHaveBeenCalledWith(5678);
      expect(mocks.unregisterActiveRequest).toHaveBeenCalledWith('7');
    });

    it('GIVEN a falsy requestId WHEN cancellation notification is received THEN it returns early without any action', async () => {
      const handler = await createServerAndCaptureHandler();

      await handler({ params: { requestId: 0 } });

      expect(mocks.getActiveRequest).not.toHaveBeenCalled();
      expect(mocks.killProcess).not.toHaveBeenCalled();
      expect(mocks.unregisterActiveRequest).not.toHaveBeenCalled();
    });
  });
});
