import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from './create-server';
import type { ProvidersFile } from '../../shared';
import type { AsyncViFn, SyncViFn } from '../../shared/command-execution/test/common/vi-fn.type';
import { NO_PROVIDERS_WARNING } from '../common';

type LoadConfigOptions = { readonly configPath?: string };

type LoadConfigMock = AsyncViFn<[options?: LoadConfigOptions], ProvidersFile>;
type ResolveCliBinaryMock = AsyncViFn<[command: string], string | undefined>;
type RegisterAllToolsMock = SyncViFn<[server: unknown, resolvedProviders: unknown[], allProviders: unknown[]], void>;

type WarnDangerousFlagsMock = SyncViFn<[config: ProvidersFile, providerNames?: string[]], void>;

const mocks = vi.hoisted(() => {
  const loadConfig = vi.fn<LoadConfigMock>();
  const resolveCliBinary = vi.fn<ResolveCliBinaryMock>();
  const registerAllTools = vi.fn<RegisterAllToolsMock>();
  const warnDangerousFlags = vi.fn<WarnDangerousFlagsMock>();

  const result = {
    loadConfig,
    resolveCliBinary,
    registerAllTools,
    warnDangerousFlags,
  };

  return result;
});

vi.mock('../../config/loader', () => {
  const mockedModule = {
    loadConfig: mocks.loadConfig,
    warnDangerousFlags: mocks.warnDangerousFlags,
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

describe('createServer – warnings', () => {
  beforeEach(() => {
    mocks.loadConfig.mockReset();
    mocks.resolveCliBinary.mockReset();
    mocks.registerAllTools.mockReset();
    mocks.warnDangerousFlags.mockReset();
    vi.restoreAllMocks();
  });

  describe('dangerous auto-mode warnings', () => {
    it('GIVEN dangerous-flag warnings are disabled WHEN creating a server THEN it does not warn during startup', async () => {
      const flags = { autoMode: ['--yolo'] };
      const ask = {
        args: ['run'],
        flags,
      };
      const commands = {
        ask,
      };
      const providers = {
        copilot: buildProvider({
          command: 'copilot',
          commands,
        }),
      };
      const config: ProvidersFile = {
        configVersion: 1,
        providers,
      };

      mocks.loadConfig.mockResolvedValue(config);
      mocks.resolveCliBinary.mockResolvedValue('/usr/bin/copilot');

      await createServer({ providerNames: ['copilot'] });

      expect(mocks.warnDangerousFlags).not.toHaveBeenCalled();
    });

    it('GIVEN dangerous-flag warnings are enabled WHEN creating a server THEN it warns only for the selected providers', async () => {
      const flags = { autoMode: ['--yolo'] };
      const ask = {
        args: ['run'],
        flags,
      };
      const commands = {
        ask,
      };
      const providers = {
        copilot: buildProvider({
          command: 'copilot',
          commands,
        }),
      };
      const config: ProvidersFile = {
        configVersion: 1,
        providers,
      };

      mocks.loadConfig.mockResolvedValue(config);
      mocks.resolveCliBinary.mockResolvedValue('/usr/bin/copilot');

      await createServer({ providerNames: ['copilot'], warnDangerousFlags: true });

      expect(mocks.warnDangerousFlags).toHaveBeenCalledWith(config, ['copilot']);
    });
  });

  describe('zero providers warning', () => {
    it('GIVEN no providers are available WHEN creating a server THEN writes warning to stderr', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const providers = {
        missing: buildProvider({ command: 'missing-cli' }),
      };
      const config: ProvidersFile = {
        configVersion: 1,
        providers,
      };

      mocks.loadConfig.mockResolvedValue(config);
      mocks.resolveCliBinary.mockResolvedValue(undefined);

      await createServer();

      expect(stderrSpy).toHaveBeenCalledWith(NO_PROVIDERS_WARNING);
    });

    it('GIVEN at least one provider is available WHEN creating a server THEN does not write warning to stderr', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const providers = {
        available: buildProvider({ command: 'available-cli' }),
      };
      const config: ProvidersFile = {
        configVersion: 1,
        providers,
      };

      mocks.loadConfig.mockResolvedValue(config);
      mocks.resolveCliBinary.mockResolvedValue('/usr/bin/available-cli');

      await createServer();

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('GIVEN all providers are disabled WHEN creating a server THEN writes warning to stderr', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const providers = {
        disabled: buildProvider({ enabled: false, command: 'disabled-cli' }),
      };
      const config: ProvidersFile = {
        configVersion: 1,
        providers,
      };

      mocks.loadConfig.mockResolvedValue(config);

      await createServer();

      expect(stderrSpy).toHaveBeenCalledWith(NO_PROVIDERS_WARNING);
    });
  });
});
