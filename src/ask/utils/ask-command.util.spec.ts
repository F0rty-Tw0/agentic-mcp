import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCommandFailure,
  buildCommandOptions,
  buildExecutionEnv,
  buildNativeSessionArgs,
  resolveModelHint,
  validateAndResolveArgs,
} from './ask-command.util';
import type { ExecuteCommandOptions, ProviderConfig, ResolvedProviderEntry } from '../../shared/common';
import { CommandExecutionError, ValidationError } from '../../shared/common/errors';
import { TEST_MINIMAL_ENV_STUB } from '../../shared/common/stubs';
import type { AskToolArgs } from '../common';

const mocks = vi.hoisted(() => ({
  validatePromptSize: vi.fn(),
  validateModel: vi.fn(),
  validateSessionId: vi.fn(),
  validateWorkingDirectory: vi.fn(),
  validateFiles: vi.fn(),
  buildMinimalEnv: vi.fn(),
  resolveProviderEnv: vi.fn(),
  detectModelError: vi.fn(),
  extractAttemptedModel: vi.fn(),
  fetchAvailableModels: vi.fn(),
  buildModelHint: vi.fn(),
  executeCommand: vi.fn(),
}));

vi.mock('../../shared/utils/', () => ({
  validatePromptSize: mocks.validatePromptSize,
  validateModel: mocks.validateModel,
  validateSessionId: mocks.validateSessionId,
  validateWorkingDirectory: mocks.validateWorkingDirectory,
  validateFiles: mocks.validateFiles,
  buildMinimalEnv: mocks.buildMinimalEnv,
  detectModelError: mocks.detectModelError,
  extractAttemptedModel: mocks.extractAttemptedModel,
  fetchAvailableModels: mocks.fetchAvailableModels,
  buildModelHint: mocks.buildModelHint,
}));

vi.mock('../../shared/domain-logic/provider-env-resolver', () => ({
  resolveProviderEnv: mocks.resolveProviderEnv,
}));

vi.mock('../../shared/domain-logic/command-executor', () => ({
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

describe('validateAndResolveArgs', () => {
  it('GIVEN valid prompt-only args WHEN called THEN returns args unchanged', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);

    const args: AskToolArgs = { prompt: 'hello world' };
    const result = validateAndResolveArgs(args);

    expect(mocks.validatePromptSize).toHaveBeenCalledWith('hello world');
    expect(result).toStrictEqual(args);
  });

  it('GIVEN args with model WHEN called THEN calls validateModel with model value', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);
    mocks.validateModel.mockReturnValue(undefined);

    const args: AskToolArgs = { prompt: 'hello', model: 'gpt-4' };

    validateAndResolveArgs(args);

    expect(mocks.validateModel).toHaveBeenCalledWith('gpt-4');
  });

  it('GIVEN args without model WHEN called THEN does not call validateModel', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);

    const args: AskToolArgs = { prompt: 'hello' };

    validateAndResolveArgs(args);

    expect(mocks.validateModel).not.toHaveBeenCalled();
  });

  it('GIVEN args with session_id WHEN called THEN calls validateSessionId with session_id value', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);
    mocks.validateSessionId.mockReturnValue(undefined);

    const args: AskToolArgs = { prompt: 'hello', session_id: 'abc123' };

    validateAndResolveArgs(args);

    expect(mocks.validateSessionId).toHaveBeenCalledWith('abc123');
  });

  it('GIVEN args without session_id WHEN called THEN does not call validateSessionId', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);

    const args: AskToolArgs = { prompt: 'hello' };

    validateAndResolveArgs(args);

    expect(mocks.validateSessionId).not.toHaveBeenCalled();
  });

  it('GIVEN args with working_directory WHEN called THEN calls validateWorkingDirectory', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);
    mocks.validateWorkingDirectory.mockReturnValue('/resolved/path');

    const args: AskToolArgs = { prompt: 'hello', working_directory: '/some/path' };
    const result = validateAndResolveArgs(args);

    expect(mocks.validateWorkingDirectory).toHaveBeenCalledWith('/some/path');
    expect(result.working_directory).toBe('/resolved/path');
  });

  it('GIVEN args without working_directory WHEN called THEN does not call validateWorkingDirectory', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);

    const args: AskToolArgs = { prompt: 'hello' };

    validateAndResolveArgs(args);

    expect(mocks.validateWorkingDirectory).not.toHaveBeenCalled();
  });

  it('GIVEN args with files but no working_directory WHEN called THEN throws ValidationError', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);

    const args: AskToolArgs = { prompt: 'hello', files: ['file'] };

    expect(() => validateAndResolveArgs(args)).toThrow(ValidationError);
    expect(() => validateAndResolveArgs(args)).toThrow('working_directory is required when files are specified');
  });

  it('GIVEN args with files and working_directory WHEN called THEN calls validateFiles with resolved dir', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);
    mocks.validateWorkingDirectory.mockReturnValue('/resolved/dir');
    mocks.validateFiles.mockReturnValue(['/resolved/dir/file']);

    const args: AskToolArgs = { prompt: 'hello', working_directory: '/some/dir', files: ['file'] };
    const result = validateAndResolveArgs(args);

    expect(mocks.validateFiles).toHaveBeenCalledWith(['file'], '/resolved/dir');
    expect(result.files).toStrictEqual(['/resolved/dir/file']);
  });
});

describe('buildExecutionEnv', () => {
  it('GIVEN context WHEN called THEN calls resolveProviderEnv then buildMinimalEnv and returns result', () => {
    const context = buildContext();
    const resolvedEnv = { myKey: 'my-value' };
    const minimalEnv = { PATH: '/usr/bin', myKey: 'my-value' };

    mocks.resolveProviderEnv.mockReturnValue(resolvedEnv);
    mocks.buildMinimalEnv.mockReturnValue(minimalEnv);

    const result = buildExecutionEnv(context);

    expect(mocks.resolveProviderEnv).toHaveBeenCalledWith(context);
    expect(mocks.buildMinimalEnv).toHaveBeenCalledWith(resolvedEnv);
    expect(result).toStrictEqual(minimalEnv);
  });
});

describe('buildCommandOptions', () => {
  it('GIVEN full input WHEN called THEN returns correct ExecuteCommandOptions shape', () => {
    const context = buildContext();
    const resolved: AskToolArgs = { prompt: 'hello', working_directory: '/work/dir' };
    const cliArgs = ['--flag', 'value'];
    const stdinInput = 'stdin data';
    const env = TEST_MINIMAL_ENV_STUB;
    const onStdoutChunk = vi.fn();
    const onStderrChunk = vi.fn();
    const controller = new AbortController();
    const onSpawned = vi.fn();

    const result = buildCommandOptions({
      context,
      resolved,
      cliArgs,
      stdinInput,
      env,
      onStdoutChunk,
      onStderrChunk,
      signal: controller.signal,
      onSpawned,
    });

    expect(result.binaryPath).toBe('/usr/bin/test');
    expect(result.args).toStrictEqual(['--flag', 'value']);
    expect(result.env).toStrictEqual(TEST_MINIMAL_ENV_STUB);
    expect(result.timeoutMs).toBe(30_000);
    expect(result.stdin).toBe('stdin data');
    expect(result.cwd).toBe('/work/dir');
    expect(result.onStdoutChunk).toBe(onStdoutChunk);
    expect(result.onStderrChunk).toBe(onStderrChunk);
    expect(result.signal).toBe(controller.signal);
    expect(result.onSpawned).toBe(onSpawned);
  });

  it('GIVEN input without optional fields WHEN called THEN returns options with undefined optional fields', () => {
    const context = buildContext();
    const resolved: AskToolArgs = { prompt: 'hello' };
    const env = TEST_MINIMAL_ENV_STUB;

    const result: ExecuteCommandOptions = buildCommandOptions({
      context,
      resolved,
      cliArgs: [],
      env,
    });

    expect(result.stdin).toBeUndefined();
    expect(result.cwd).toBeUndefined();
    expect(result.onStdoutChunk).toBeUndefined();
    expect(result.onStderrChunk).toBeUndefined();
    expect(result.signal).toBeUndefined();
    expect(result.onSpawned).toBeUndefined();
  });
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

    const result = await resolveModelHint({
      context,
      args,
      stdout: 'error output',
      stderr: 'model not found',
      env: TEST_MINIMAL_ENV_STUB,
    });

    expect(mocks.fetchAvailableModels).toHaveBeenCalledWith(context, TEST_MINIMAL_ENV_STUB, mocks.executeCommand);
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
    const result = {
      stdout: '',
      stderr: 'something went wrong',
      exitCode: 1,
      signal: null,
      timedOut: false,
    };

    const error = await buildCommandFailure(context, args, TEST_MINIMAL_ENV_STUB, result);

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
