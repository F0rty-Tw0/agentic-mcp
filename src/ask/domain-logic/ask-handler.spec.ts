import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCommandOptions, buildExecutionEnv, validateAndResolveArgs } from './ask-handler';
import type { ExecuteCommandOptions, ProviderConfig, ResolvedProviderEntry } from "../../shared/common";
import { ValidationError } from "../../shared/common/errors";
import type { AskToolArgs } from "../common";

const mocks = vi.hoisted(() => ({
  validatePromptSize: vi.fn(),
  validateModel: vi.fn(),
  validateSessionId: vi.fn(),
  validateWorkingDirectory: vi.fn(),
  validateFiles: vi.fn(),
  buildMinimalEnv: vi.fn(),
  resolveProviderEnv: vi.fn(),
}));

vi.mock('../../shared/utils/', () => ({
  validatePromptSize: mocks.validatePromptSize,
  validateModel: mocks.validateModel,
  validateSessionId: mocks.validateSessionId,
  validateWorkingDirectory: mocks.validateWorkingDirectory,
  validateFiles: mocks.validateFiles,
  buildMinimalEnv: mocks.buildMinimalEnv,
}));

vi.mock('../../shared/domain-logic/provider-env-resolver', () => ({
  resolveProviderEnv: mocks.resolveProviderEnv,
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
    const env = { PATH: '/usr/bin' };
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
    expect(result.env).toStrictEqual({ PATH: '/usr/bin' });
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
    const env = { PATH: '/usr/bin' };

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
