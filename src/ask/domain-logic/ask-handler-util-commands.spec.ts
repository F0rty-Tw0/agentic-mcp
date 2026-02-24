import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCommandFailure, buildNativeSessionArgs, resolveModelHint } from './ask-handler.util.ts';
import { CommandExecutionError } from '../../shared/common/errors/index.ts';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared/common/index.ts';
import type { AskToolArgs } from '../common/index.ts';

const mocks = vi.hoisted(() => ({
  detectModelError: vi.fn(),
  extractAttemptedModel: vi.fn(),
  fetchAvailableModels: vi.fn(),
  buildModelHint: vi.fn(),
  executeCommand: vi.fn(),
}));

vi.mock('../../shared/utils/index.ts', () => ({
  detectModelError: mocks.detectModelError,
  extractAttemptedModel: mocks.extractAttemptedModel,
  fetchAvailableModels: mocks.fetchAvailableModels,
  buildModelHint: mocks.buildModelHint,
}));

vi.mock('../../shared/domain-logic/command-executor.ts', () => ({
  executeCommand: mocks.executeCommand,
}));

const buildProviderConfig = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  enabled: true,
  description: 'test provider',
  command: 'test-cli',
  timeout: 30_000,
  env: {},
  outputFormat: 'text',
  commands: {
    ask: { args: [] },
  },
  input: { method: 'positional' },
  ...overrides,
});

const buildContext = (overrides: Partial<ResolvedProviderEntry> = {}): ResolvedProviderEntry => ({
  name: 'test-provider',
  binaryPath: '/usr/bin/test',
  config: buildProviderConfig(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildNativeSessionArgs', () => {
  it('GIVEN config without sessions command WHEN called THEN returns empty array', () => {
    const config = buildProviderConfig();
    const result = buildNativeSessionArgs(config, 'session-123');

    expect(result).toStrictEqual([]);
  });

  it('GIVEN config with sessions command but no flags WHEN called THEN returns empty array', () => {
    const config = buildProviderConfig({
      commands: {
        ask: { args: [] },
        sessions: {},
      },
    });

    const result = buildNativeSessionArgs(config, 'session-123');

    expect(result).toStrictEqual([]);
  });

  it('GIVEN config with resume flag as string WHEN called THEN returns resume flag and session id', () => {
    const config = buildProviderConfig({
      commands: {
        ask: { args: [] },
        sessions: {
          flags: {
            resume: '--resume',
          },
        },
      },
    });

    const result = buildNativeSessionArgs(config, 'session-123');

    expect(result).toStrictEqual(['--resume', 'session-123']);
  });

  it('GIVEN config with resume flag as array WHEN called THEN returns all flag parts and session id', () => {
    const config = buildProviderConfig({
      commands: {
        ask: { args: [] },
        sessions: {
          flags: {
            resume: ['--resume', '--session'],
          },
        },
      },
    });

    const result = buildNativeSessionArgs(config, 'session-123');

    expect(result).toStrictEqual(['--resume', '--session', 'session-123']);
  });

  it('GIVEN config with continue flag but no resume flag WHEN called THEN returns continue flag args', () => {
    const config = buildProviderConfig({
      commands: {
        ask: { args: [] },
        sessions: {
          flags: {
            continue: '--continue',
          },
        },
      },
    });

    const result = buildNativeSessionArgs(config, 'session-456');

    expect(result).toStrictEqual(['--continue', 'session-456']);
  });

  it('GIVEN config with leveled resume flag where session id is in values WHEN called THEN returns flag and session id', () => {
    const config = buildProviderConfig({
      commands: {
        ask: { args: [] },
        sessions: {
          flags: {
            resume: { flag: '--resume', values: ['session-789', 'other-session'] },
          },
        },
      },
    });

    const result = buildNativeSessionArgs(config, 'session-789');

    expect(result).toStrictEqual(['--resume', 'session-789']);
  });

  it('GIVEN config with leveled resume flag where session id is not in values WHEN called THEN returns empty array', () => {
    const config = buildProviderConfig({
      commands: {
        ask: { args: [] },
        sessions: {
          flags: {
            resume: { flag: '--resume', values: ['other-session'] },
          },
        },
      },
    });

    const result = buildNativeSessionArgs(config, 'session-789');

    expect(result).toStrictEqual([]);
  });
});

describe('resolveModelHint', () => {
  it('GIVEN no model error detected WHEN called THEN returns empty string', async () => {
    mocks.detectModelError.mockReturnValue(false);

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };

    const result = await resolveModelHint({
      context,
      args,
      stdout: 'some output',
      stderr: '',
      env: {},
    });

    expect(result).toBe('');
    expect(mocks.fetchAvailableModels).not.toHaveBeenCalled();
  });

  it('GIVEN model error detected WHEN called THEN fetches available models and builds hint', async () => {
    mocks.detectModelError.mockReturnValue(true);
    mocks.fetchAvailableModels.mockResolvedValue(['model-a', 'model-b']);
    mocks.extractAttemptedModel.mockReturnValue('bad-model');
    mocks.buildModelHint.mockReturnValue('. Available models: model-a, model-b');

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };
    const env = { PATH: '/usr/bin' };

    const result = await resolveModelHint({
      context,
      args,
      stdout: 'error output',
      stderr: 'model not found',
      env,
    });

    expect(mocks.fetchAvailableModels).toHaveBeenCalledWith(context, env, mocks.executeCommand);
    expect(mocks.extractAttemptedModel).toHaveBeenCalledWith('error output', 'model not found');
    expect(mocks.buildModelHint).toHaveBeenCalledWith('test-provider', 'bad-model', ['model-a', 'model-b'], false);
    expect(result).toBe('. Available models: model-a, model-b');
  });

  it('GIVEN model error detected and args has model WHEN called THEN uses args.model instead of extracting', async () => {
    mocks.detectModelError.mockReturnValue(true);
    mocks.fetchAvailableModels.mockResolvedValue(['model-a']);
    mocks.buildModelHint.mockReturnValue('. hint text');

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello', model: 'explicit-model' };

    await resolveModelHint({
      context,
      args,
      stdout: '',
      stderr: '',
      env: {},
    });

    expect(mocks.extractAttemptedModel).not.toHaveBeenCalled();
    expect(mocks.buildModelHint).toHaveBeenCalledWith('test-provider', 'explicit-model', ['model-a'], true);
  });
});

describe('buildCommandFailure', () => {
  it('GIVEN failed result with no model hint WHEN called THEN returns CommandExecutionError with details', async () => {
    mocks.detectModelError.mockReturnValue(false);

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };
    const env = { PATH: '/usr/bin' };
    const result = {
      stdout: '',
      stderr: 'something went wrong',
      exitCode: 1,
      signal: null,
      timedOut: false,
    };

    const error = await buildCommandFailure(context, args, env, result);

    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error.message).toBe('test-provider command failed');
    expect(error.exitCode).toBe(1);
    expect(error.signal).toBeNull();
    expect(error.timedOut).toBe(false);
    expect(error.stderr).toBe('something went wrong');
  });

  it('GIVEN failed result with model hint WHEN called THEN returns CommandExecutionError with hint appended', async () => {
    mocks.detectModelError.mockReturnValue(true);
    mocks.fetchAvailableModels.mockResolvedValue(['model-a']);
    mocks.extractAttemptedModel.mockReturnValue(undefined);
    mocks.buildModelHint.mockReturnValue('. Try: model-a');

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };
    const env = {};
    const result = {
      stdout: 'bad model error',
      stderr: '',
      exitCode: 2,
      signal: null,
      timedOut: false,
    };

    const error = await buildCommandFailure(context, args, env, result);

    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error.message).toBe('test-provider command failed. Try: model-a');
  });

  it('GIVEN timed out result WHEN called THEN returns CommandExecutionError with timedOut true', async () => {
    mocks.detectModelError.mockReturnValue(false);

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };
    const result = {
      stdout: '',
      stderr: '',
      exitCode: null,
      signal: null,
      timedOut: true,
    };

    const error = await buildCommandFailure(context, args, {}, result);

    expect(error.timedOut).toBe(true);
    expect(error.exitCode).toBeNull();
  });

  it('GIVEN result with signal WHEN called THEN returns CommandExecutionError with signal set', async () => {
    mocks.detectModelError.mockReturnValue(false);

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };
    const result = {
      stdout: '',
      stderr: '',
      exitCode: null,
      signal: 'SIGTERM',
      timedOut: false,
    };

    const error = await buildCommandFailure(context, args, {}, result);

    expect(error.signal).toBe('SIGTERM');
  });
});
