import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from './create-server';
import type { ProvidersFile } from '../../shared';
import type { AsyncViFn, SyncViFn } from '../../shared/command-execution/common/test-utils';
import { NO_PROVIDERS_WARNING } from '../common';

type LoadConfigMock = AsyncViFn<[options?: { configPath?: string }], ProvidersFile>;
type ResolveCliBinaryMock = AsyncViFn<[command: string], string | undefined>;
type RegisterAllToolsMock = SyncViFn<[server: unknown, resolvedProviders: unknown[], allProviders: unknown[]], void>;

type WarnDangerousFlagsMock = SyncViFn<[config: ProvidersFile, providerNames?: readonly string[]], void>;

const mocks = vi.hoisted(() => {
  const loadConfig = vi.fn<LoadConfigMock>();
  const resolveCliBinary = vi.fn<ResolveCliBinaryMock>();
  const registerAllTools = vi.fn<RegisterAllToolsMock>();
  const warnDangerousFlags = vi.fn<WarnDangerousFlagsMock>();

  return {
    loadConfig,
    resolveCliBinary,
    registerAllTools,
    warnDangerousFlags,
  };
});

vi.mock('../../config/loader', () => ({
  loadConfig: mocks.loadConfig,
  warnDangerousFlags: mocks.warnDangerousFlags,
}));

vi.mock('../../shared/command-execution/utils/platform.util', () => ({
  resolveCliBinary: mocks.resolveCliBinary,
  killProcess: vi.fn(),
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
      const config: ProvidersFile = {
        configVersion: 1,
        providers: {
          copilot: buildProvider({
            command: 'copilot',
            commands: {
              ask: {
                args: ['run'],
                flags: { autoMode: ['--yolo'] },
              },
            },
          }),
        },
      };

      mocks.loadConfig.mockResolvedValue(config);
      mocks.resolveCliBinary.mockResolvedValue('/usr/bin/copilot');

      await createServer({ providerNames: ['copilot'] });

      expect(mocks.warnDangerousFlags).not.toHaveBeenCalled();
    });

    it('GIVEN dangerous-flag warnings are enabled WHEN creating a server THEN it warns only for the selected providers', async () => {
      const config: ProvidersFile = {
        configVersion: 1,
        providers: {
          copilot: buildProvider({
            command: 'copilot',
            commands: {
              ask: {
                args: ['run'],
                flags: { autoMode: ['--yolo'] },
              },
            },
          }),
        },
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
      const config: ProvidersFile = {
        configVersion: 1,
        providers: {
          missing: buildProvider({ command: 'missing-cli' }),
        },
      };

      mocks.loadConfig.mockResolvedValue(config);
      mocks.resolveCliBinary.mockResolvedValue(undefined);

      await createServer();

      expect(stderrSpy).toHaveBeenCalledWith(NO_PROVIDERS_WARNING);
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

      expect(stderrSpy).toHaveBeenCalledWith(NO_PROVIDERS_WARNING);
    });
  });
});
