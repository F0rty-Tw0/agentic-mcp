import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCommandFailure, buildExecutionEnv, resolveModelFallback, resolveModelHint } from './ask-command';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared';
import { CommandExecutionError, TEST_MINIMAL_ENV_STUB } from '../../shared';
import type { AskToolArgs } from '../common';

const mocks = vi.hoisted(() => ({
  validatePromptSize: vi.fn(),
  validateModel: vi.fn(),
  validateSessionId: vi.fn(),
  validateWorkingDirectory: vi.fn(),
  validateFiles: vi.fn(),
  modelRegex: /^[a-zA-Z0-9][a-zA-Z0-9._:\-/]{0,127}$/,
  buildMinimalEnv: vi.fn(),
  stripAnsi: vi.fn((input: string) => input),
  resolveProviderEnv: vi.fn(),
  detectModelError: vi.fn(),
  extractAttemptedModel: vi.fn(),
  fetchAvailableModels: vi.fn(),
  parseFirstAvailableModel: vi.fn(),
  selectClosestAvailableModel: vi.fn(),
  buildModelHint: vi.fn(),
  executeCommand: vi.fn(),
}));

vi.mock('../../shared/validation/utils/validation.util', () => ({
  validatePromptSize: mocks.validatePromptSize,
  validateModel: mocks.validateModel,
  validateSessionId: mocks.validateSessionId,
  validateWorkingDirectory: mocks.validateWorkingDirectory,
  validateFiles: mocks.validateFiles,
  modelRegex: mocks.modelRegex,
}));

vi.mock('../../shared/command-execution/utils/platform.util', () => ({
  buildMinimalEnv: mocks.buildMinimalEnv,
  stripAnsi: mocks.stripAnsi,
}));

vi.mock('../../shared/provider/utils/model-error.util', () => ({
  detectModelError: mocks.detectModelError,
  extractAttemptedModel: mocks.extractAttemptedModel,
  fetchAvailableModels: mocks.fetchAvailableModels,
  parseFirstAvailableModel: mocks.parseFirstAvailableModel,
  selectClosestAvailableModel: mocks.selectClosestAvailableModel,
  buildModelHint: mocks.buildModelHint,
}));

vi.mock('../../shared/provider/domain-logic/provider-env-resolver', () => ({
  resolveProviderEnv: mocks.resolveProviderEnv,
}));

vi.mock('../../shared/command-execution/domain-logic/command-executor', () => ({
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
      truncated: false,
      stdoutBytes: 0,
      stderrBytes: 21,
      executionTimeMs: 100,
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
      truncated: false,
      stdoutBytes: 15,
      stderrBytes: 0,
      executionTimeMs: 100,
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
      truncated: false,
      stdoutBytes: 0,
      stderrBytes: 0,
      executionTimeMs: 100,
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
      truncated: false,
      stdoutBytes: 0,
      stderrBytes: 0,
      executionTimeMs: 100,
    };

    const error = await buildCommandFailure(context, args, {}, result);

    expect(error.signal).toBe('SIGTERM');
  });
});

describe('resolveModelFallback', () => {
  it('GIVEN user-specified model WHEN called THEN returns undefined without checking', async () => {
    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello', model: 'user-model' };

    const result = await resolveModelFallback({ context, args, stdout: 'model not found', stderr: '', env: {} });

    expect(result).toBeUndefined();
    expect(mocks.detectModelError).not.toHaveBeenCalled();
  });

  it('GIVEN no model error detected WHEN called THEN returns undefined', async () => {
    mocks.detectModelError.mockReturnValue(false);

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };

    const result = await resolveModelFallback({ context, args, stdout: 'some output', stderr: '', env: {} });

    expect(result).toBeUndefined();
    expect(mocks.fetchAvailableModels).not.toHaveBeenCalled();
  });

  it('GIVEN model error and available models WHEN called THEN returns first available model', async () => {
    mocks.detectModelError.mockReturnValue(true);
    mocks.fetchAvailableModels.mockResolvedValue('opencode/gpt-5-nano\ngithub-copilot/claude-sonnet-4');
    mocks.parseFirstAvailableModel.mockReturnValue('opencode/gpt-5-nano');

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };

    const result = await resolveModelFallback({ context, args, stdout: 'model not found', stderr: '', env: {} });

    expect(result).toBe('opencode/gpt-5-nano');
    expect(mocks.parseFirstAvailableModel).toHaveBeenCalledWith('opencode/gpt-5-nano\ngithub-copilot/claude-sonnet-4');
  });

  it('GIVEN model error but no available models WHEN called THEN returns undefined', async () => {
    mocks.detectModelError.mockReturnValue(true);
    mocks.fetchAvailableModels.mockResolvedValue(undefined);

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };

    const result = await resolveModelFallback({ context, args, stdout: 'model not found', stderr: '', env: {} });

    expect(result).toBeUndefined();
    expect(mocks.parseFirstAvailableModel).not.toHaveBeenCalled();
  });

  it('GIVEN model error and empty model list WHEN called THEN returns undefined', async () => {
    mocks.detectModelError.mockReturnValue(true);
    mocks.fetchAvailableModels.mockResolvedValue('');

    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };

    const result = await resolveModelFallback({ context, args, stdout: 'model not found', stderr: '', env: {} });

    expect(result).toBeUndefined();
  });
});
