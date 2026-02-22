import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildModelHint, detectModelError, extractAttemptedModel, fetchAvailableModels } from './model-error.util.ts';
import type { ExecuteCommandOptions, ExecutionResult } from '../../../shared/common/command-executor.types.ts';
import type { ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/provider-config.type.ts';

describe('detectModelError', () => {
  it('GIVEN stdout with model-not-found text WHEN detecting THEN returns true', () => {
    const result = detectModelError('Error: model not found', '');

    expect(result).toBe(true);
  });

  it('GIVEN stderr with unknown model text WHEN detecting THEN returns true', () => {
    const result = detectModelError('', 'unknown model: bad-model');

    expect(result).toBe(true);
  });

  it('GIVEN output without model error text WHEN detecting THEN returns false', () => {
    const result = detectModelError('all good', '');

    expect(result).toBe(false);
  });
});

describe('extractAttemptedModel', () => {
  it('GIVEN stdout with "Model not found: opencode/claude-opus-4-6." WHEN extracting THEN returns model name', () => {
    const result = extractAttemptedModel('Model not found: opencode/claude-opus-4-6.', '');

    expect(result).toBe('opencode/claude-opus-4-6');
  });

  it('GIVEN stderr with "unknown model: bad-model" WHEN extracting THEN returns model name', () => {
    const result = extractAttemptedModel('', 'unknown model: bad-model');

    expect(result).toBe('bad-model');
  });

  it('GIVEN JSON error with model name WHEN extracting THEN returns model name', () => {
    const result = extractAttemptedModel('{"error":{"message":"Model not found: opencode/gpt-5."}}', '');

    expect(result).toBe('opencode/gpt-5');
  });

  it('GIVEN output without model reference WHEN extracting THEN returns null', () => {
    const result = extractAttemptedModel('something went wrong', 'general error');

    expect(result).toBeUndefined();
  });

  it('GIVEN "invalid model" with quoted name WHEN extracting THEN returns model name', () => {
    const result = extractAttemptedModel('', 'invalid model "my-model"');

    expect(result).toBe('my-model');
  });
});

describe('buildModelHint', () => {
  it('GIVEN user-specified model and available models WHEN building hint THEN includes both', () => {
    const result = buildModelHint('opencode', 'bad-model', 'opencode/gpt-5-nano\ngithub-copilot/claude-sonnet-4');

    expect(result).toContain('"bad-model"');
    expect(result).toContain('"opencode"');
    expect(result).toContain('Available models:');
    expect(result).toContain('opencode/gpt-5-nano');
    expect(result).toContain('github-copilot/claude-sonnet-4');
  });

  it('GIVEN user-specified model and no available models WHEN building hint THEN shows model name and fallback', () => {
    const result = buildModelHint('opencode', 'bad-model');

    expect(result).toContain('"bad-model"');
    expect(result).toContain('"opencode"');
    expect(result).toContain('not available for this provider');
    expect(result).not.toContain('Available models:');
  });

  it('GIVEN CLI default model and available models WHEN building hint THEN mentions CLI default and list', () => {
    const result = buildModelHint('opencode', 'opencode/claude-opus-4-6', 'opencode/gpt-5-nano', false);

    expect(result).toContain('No model was specified');
    expect(result).toContain('"opencode/claude-opus-4-6"');
    expect(result).toContain('Available models:');
    expect(result).toContain('opencode/gpt-5-nano');
  });

  it('GIVEN CLI default model and no available models WHEN building hint THEN mentions CLI default and fallback', () => {
    const result = buildModelHint('opencode', 'opencode/claude-opus-4-6', undefined, false);

    expect(result).toContain('No model was specified');
    expect(result).toContain('"opencode/claude-opus-4-6"');
    expect(result).toContain('not available for this provider');
  });

  it('GIVEN no model at all and available models WHEN building hint THEN shows no-default message and list', () => {
    const result = buildModelHint('opencode', undefined, 'opencode/gpt-5-nano');

    expect(result).toContain('No model was specified');
    expect(result).toContain('no default configured');
    expect(result).toContain('Available models:');
    expect(result).toContain('opencode/gpt-5-nano');
  });

  it('GIVEN no model at all and no available models WHEN building hint THEN shows no-default and fallback', () => {
    const result = buildModelHint('opencode');

    expect(result).toContain('No model was specified');
    expect(result).toContain('no default configured');
    expect(result).toContain('not available for this provider');
  });
});

describe('fetchAvailableModels', () => {
  const createContext = (commandsOverride?: ProviderConfig['commands']): ResolvedProviderEntry => {
    const config: ProviderConfig = {
      enabled: true,
      description: 'Test provider',
      command: 'test-cli',
      timeout: 120_000,
      env: {},
      outputFormat: 'json',
      commands: commandsOverride ?? { ask: { args: ['run'], flags: {} } },
      input: { method: 'positional' },
    };

    return { name: 'test', binaryPath: '/usr/bin/test-cli', config };
  };

  const mockEnv: Readonly<Record<string, string>> = { PATH: '/usr/bin' };
  let mockExecuteCommand: ReturnType<typeof vi.fn<(options: ExecuteCommandOptions) => Promise<ExecutionResult>>>;

  beforeEach(() => {
    mockExecuteCommand = vi.fn<(options: ExecuteCommandOptions) => Promise<ExecutionResult>>();
  });

  it('GIVEN provider with models command and success WHEN fetching THEN returns trimmed stdout', async () => {
    const context = createContext({
      ask: { args: ['run'], flags: {} },
      models: { args: ['models'] },
    });

    mockExecuteCommand.mockResolvedValue({
      stdout: '  opencode/gpt-5-nano\n  github-copilot/claude-sonnet-4\n',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 50,
      stderrBytes: 0,
      executionTimeMs: 200,
    });

    const result = await fetchAvailableModels(context, mockEnv, mockExecuteCommand);

    expect(result).toBe('opencode/gpt-5-nano\n  github-copilot/claude-sonnet-4');
    expect(mockExecuteCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        binaryPath: '/usr/bin/test-cli',
        args: ['models'],
        bypassSemaphore: true,
      })
    );
  });

  it('GIVEN provider without models command WHEN fetching THEN returns null', async () => {
    const context = createContext({ ask: { args: ['run'], flags: {} } });

    const result = await fetchAvailableModels(context, mockEnv, mockExecuteCommand);

    expect(result).toBeUndefined();
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('GIVEN models command with non-zero exit WHEN fetching THEN returns null', async () => {
    const context = createContext({
      ask: { args: ['run'], flags: {} },
      models: { args: ['models'] },
    });

    mockExecuteCommand.mockResolvedValue({
      stdout: '',
      stderr: 'error',
      exitCode: 1,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 0,
      stderrBytes: 5,
      executionTimeMs: 100,
    });

    const result = await fetchAvailableModels(context, mockEnv, mockExecuteCommand);

    expect(result).toBeUndefined();
  });

  it('GIVEN models command that times out WHEN fetching THEN returns null', async () => {
    const context = createContext({
      ask: { args: ['run'], flags: {} },
      models: { args: ['models'] },
    });

    mockExecuteCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: null,
      signal: null,
      timedOut: true,
      truncated: false,
      stdoutBytes: 0,
      stderrBytes: 0,
      executionTimeMs: 10_000,
    });

    const result = await fetchAvailableModels(context, mockEnv, mockExecuteCommand);

    expect(result).toBeUndefined();
  });

  it('GIVEN models command terminated by signal WHEN fetching THEN returns null', async () => {
    const context = createContext({
      ask: { args: ['run'], flags: {} },
      models: { args: ['models'] },
    });

    mockExecuteCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: null,
      signal: 'SIGTERM',
      timedOut: false,
      truncated: false,
      stdoutBytes: 0,
      stderrBytes: 0,
      executionTimeMs: 250,
    });

    const result = await fetchAvailableModels(context, mockEnv, mockExecuteCommand);

    expect(result).toBeUndefined();
  });

  it('GIVEN models command that throws WHEN fetching THEN returns null', async () => {
    const context = createContext({
      ask: { args: ['run'], flags: {} },
      models: { args: ['models'] },
    });

    mockExecuteCommand.mockRejectedValue(new Error('spawn ENOENT'));

    const result = await fetchAvailableModels(context, mockEnv, mockExecuteCommand);

    expect(result).toBeUndefined();
  });

  it('GIVEN models command with empty stdout WHEN fetching THEN returns null', async () => {
    const context = createContext({
      ask: { args: ['run'], flags: {} },
      models: { args: ['models'] },
    });

    mockExecuteCommand.mockResolvedValue({
      stdout: '   \n  ',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 5,
      stderrBytes: 0,
      executionTimeMs: 50,
    });

    const result = await fetchAvailableModels(context, mockEnv, mockExecuteCommand);

    expect(result).toBeUndefined();
  });
});
