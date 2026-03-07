import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildModelHint,
  detectModelError,
  extractAttemptedModel,
  fetchAvailableModels,
  parseFirstAvailableModel,
  selectClosestAvailableModel,
} from './model-error.util';
import type { ExecuteCommandOptions, ExecutionResult } from '../../command-execution/common';
import { SUCCESS_EXECUTION_RESULT_STUB, TEST_MINIMAL_ENV_STUB } from '../../command-execution/common/stubs';
import type { ProviderConfig, ResolvedProviderEntry } from '../common';
import { TEST_PROVIDER_CONFIG_STUB, TEST_RESOLVED_PROVIDER_ENTRY_STUB } from '../common/stubs';

type MinimalEnv = Readonly<Record<string, string>>;

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
      ...TEST_PROVIDER_CONFIG_STUB,
      commands: commandsOverride ?? { ask: { args: ['run'], flags: {} } },
    };

    const context: ResolvedProviderEntry = {
      ...TEST_RESOLVED_PROVIDER_ENTRY_STUB,
      config,
    };

    return context;
  };

  const mockEnv: MinimalEnv = TEST_MINIMAL_ENV_STUB;
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
      ...SUCCESS_EXECUTION_RESULT_STUB,
      stdout: '  opencode/gpt-5-nano\n  github-copilot/claude-sonnet-4\n',
      stdoutBytes: 50,
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
      ...SUCCESS_EXECUTION_RESULT_STUB,
      stdout: '',
      stderr: 'error',
      exitCode: 1,
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
      ...SUCCESS_EXECUTION_RESULT_STUB,
      stdout: '',
      exitCode: null,
      signal: null,
      timedOut: true,
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
      ...SUCCESS_EXECUTION_RESULT_STUB,
      stdout: '',
      exitCode: null,
      signal: 'SIGTERM',
      timedOut: false,
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
      ...SUCCESS_EXECUTION_RESULT_STUB,
      stdout: '   \n  ',
      stdoutBytes: 5,
      executionTimeMs: 50,
    });

    const result = await fetchAvailableModels(context, mockEnv, mockExecuteCommand);

    expect(result).toBeUndefined();
  });
});

describe('parseFirstAvailableModel', () => {
  it('GIVEN newline-separated model list WHEN parsing THEN returns first model', () => {
    const result = parseFirstAvailableModel('opencode/big-pickle\nopencode/gpt-5-nano\ngithub-copilot/claude-sonnet-4');

    expect(result).toBe('opencode/big-pickle');
  });

  it('GIVEN models with leading whitespace WHEN parsing THEN returns trimmed first model', () => {
    const result = parseFirstAvailableModel('  opencode/gpt-5-nano\n  github-copilot/claude-sonnet-4\n');

    expect(result).toBe('opencode/gpt-5-nano');
  });

  it('GIVEN models with comment lines WHEN parsing THEN skips comments', () => {
    const result = parseFirstAvailableModel('# Available models\nopencode/gpt-5-nano\ngithub-copilot/claude-sonnet-4');

    expect(result).toBe('opencode/gpt-5-nano');
  });

  it('GIVEN models with dash-prefixed lines WHEN parsing THEN skips dashed lines', () => {
    const result = parseFirstAvailableModel('- header\nopencode/gpt-5-nano');

    expect(result).toBe('opencode/gpt-5-nano');
  });

  it('GIVEN empty string WHEN parsing THEN returns undefined', () => {
    const result = parseFirstAvailableModel('');

    expect(result).toBeUndefined();
  });

  it('GIVEN only whitespace and empty lines WHEN parsing THEN returns undefined', () => {
    const result = parseFirstAvailableModel('  \n  \n  ');

    expect(result).toBeUndefined();
  });

  it('GIVEN Windows-style line endings WHEN parsing THEN returns first model', () => {
    const result = parseFirstAvailableModel('opencode/big-pickle\r\nopencode/gpt-5-nano\r\n');

    expect(result).toBe('opencode/big-pickle');
  });

  it('GIVEN leading empty lines WHEN parsing THEN skips them and returns first model', () => {
    const result = parseFirstAvailableModel('\n\nopencode/gpt-5-nano');

    expect(result).toBe('opencode/gpt-5-nano');
  });
});

describe('selectClosestAvailableModel', () => {
  it('GIVEN exact model match WHEN selecting THEN returns exact model', () => {
    const availableModels = 'openai/gpt-5.4\nopenai/gpt-5.3-codex';

    const result = selectClosestAvailableModel('openai/gpt-5.4', availableModels);

    expect(result).toBe('openai/gpt-5.4');
  });

  it('GIVEN friendly codex 5.4 label WHEN selecting THEN returns closest exposed model', () => {
    const availableModels = 'openai/gpt-5.4\nopenai/gpt-5.3-codex';

    const result = selectClosestAvailableModel('codex 5.4', availableModels);

    expect(result).toBe('openai/gpt-5.4');
  });

  it('GIVEN no meaningful overlap WHEN selecting THEN returns undefined', () => {
    const availableModels = 'google/gemini-2.5-pro\nclaude-sonnet-4.6';

    const result = selectClosestAvailableModel('codex 5.4', availableModels);

    expect(result).toBeUndefined();
  });
});
