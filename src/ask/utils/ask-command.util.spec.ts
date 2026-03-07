import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCommandOptions, buildNativeSessionArgs, validateAndResolveArgs } from './ask-command.util';
import type { ExecuteCommandOptions, ProviderConfig, ResolvedProviderEntry } from '../../shared';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS, TEST_MINIMAL_ENV_STUB, ValidationError } from '../../shared';
import type { AskToolArgs } from '../common';

const mocks = vi.hoisted(() => ({
  validatePromptSize: vi.fn(),
  validateModel: vi.fn(),
  validateSessionId: vi.fn(),
  validateWorkingDirectory: vi.fn(),
  validateFiles: vi.fn(),
}));

vi.mock('../../shared/validation/utils/validation.util', () => ({
  validatePromptSize: mocks.validatePromptSize,
  validateModel: mocks.validateModel,
  validateSessionId: mocks.validateSessionId,
  validateWorkingDirectory: mocks.validateWorkingDirectory,
  validateFiles: mocks.validateFiles,
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

  it('GIVEN copilot codex 5.3 alias WHEN called THEN validates normalized model value', () => {
    mocks.validatePromptSize.mockReturnValue(undefined);
    mocks.validateModel.mockReturnValue(undefined);

    const args: AskToolArgs = { prompt: 'hello', model: 'codex 5.3' };

    const result = validateAndResolveArgs(args, 'copilot');

    expect(mocks.validateModel).toHaveBeenCalledWith('gpt-5.3-codex');
    expect(result.model).toBe('gpt-5.3-codex');
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

describe('buildCommandOptions', () => {
  it('GIVEN provider timeout lower than MCP default WHEN called THEN uses MCP default timeout floor', () => {
    const context = buildContext({ config: buildProviderConfig({ timeout: 30_000 }) });
    const resolved: AskToolArgs = { prompt: 'hello' };
    const env = TEST_MINIMAL_ENV_STUB;

    const result = buildCommandOptions({
      context,
      resolved,
      cliArgs: [],
      env,
    });

    expect(result.timeoutMs).toBe(DEFAULT_MCP_TOOL_TIMEOUT_MS);
  });

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
    expect(result.timeoutMs).toBe(DEFAULT_MCP_TOOL_TIMEOUT_MS);
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
