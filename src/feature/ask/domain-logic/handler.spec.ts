/* eslint-disable @typescript-eslint/naming-convention */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './handler.ts';
import type { ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/provider-config.type.ts';

vi.mock('./arg-builder.ts', () => ({
  buildArgArray: vi.fn(() => ({ args: ['exec', 'test prompt'], stdinInput: undefined })),
}));

vi.mock('../../../shared/domain-logic/command-executor.ts', () => ({
  executeCommand: vi.fn(async () =>
    Promise.resolve({
      stdout: 'command output',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 14,
      stderrBytes: 0,
      executionTimeMs: 100,
    }),
  ),
}));

vi.mock('../../../shared/utils/platform.ts', () => ({
  buildMinimalEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
  stripAnsi: vi.fn((input: string) => input),
}));

// Real validation — no mock (validates real behaviour)
// Real toMcpError — no mock (validates real error mapping)

const { buildArgArray } = await import('./arg-builder.ts');
const { executeCommand } = await import('../../../shared/domain-logic/command-executor.ts');
const { buildMinimalEnv, stripAnsi } = await import('../../../shared/utils/platform.ts');

const createContext = (overrides: Partial<ProviderConfig> = {}): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    enabled: true,
    description: 'Test provider',
    command: 'test-cli',
    timeout: 120_000,
    env: {},
    outputFormat: 'json',
    commands: { ask: { args: ['exec'], flags: {} } },
    input: { method: 'positional' },
    ...overrides,
  };

  return { name: 'test', binaryPath: '/usr/bin/test-cli', config };
};

describe('handleAsk', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(buildArgArray).mockReturnValue({ args: ['exec', 'test prompt'], stdinInput: undefined });

    vi.mocked(executeCommand).mockResolvedValue({
      stdout: 'command output',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 14,
      stderrBytes: 0,
      executionTimeMs: 100,
    });

    vi.mocked(buildMinimalEnv).mockReturnValue({ PATH: '/usr/bin' });
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
  });

  describe('successful execution', () => {
    it('GIVEN valid prompt WHEN handling ask THEN returns text content with command output', async () => {
      const context = createContext();

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'command output' }],
      });
    });

    it('GIVEN valid prompt WHEN handling ask THEN calls buildArgArray with config and resolved args', async () => {
      const context = createContext();

      await handleAsk(context, { prompt: 'test prompt' });

      expect(buildArgArray).toHaveBeenCalledWith(context.config, expect.objectContaining({ prompt: 'test prompt' }));
    });

    it('GIVEN valid prompt WHEN handling ask THEN calls buildMinimalEnv with provider env', async () => {
      const context = createContext({ env: { API_KEY: 'secret' } });

      await handleAsk(context, { prompt: 'test prompt' });

      expect(buildMinimalEnv).toHaveBeenCalledWith({ API_KEY: 'secret' });
    });

    it('GIVEN valid prompt WHEN handling ask THEN calls executeCommand with correct options', async () => {
      const context = createContext();

      await handleAsk(context, { prompt: 'test prompt' });

      expect(executeCommand).toHaveBeenCalledWith({
        binaryPath: '/usr/bin/test-cli',
        args: ['exec', 'test prompt'],
        env: { PATH: '/usr/bin' },
        timeoutMs: 120_000,
        stdin: undefined,
        cwd: undefined,
      });
    });

    it('GIVEN stdin input method WHEN handling ask THEN passes stdinInput to executeCommand', async () => {
      const context = createContext({ input: { method: 'stdin' } });

      vi.mocked(buildArgArray).mockReturnValue({ args: ['exec'], stdinInput: 'test prompt' });

      await handleAsk(context, { prompt: 'test prompt' });

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({ stdin: 'test prompt' }));
    });

    it('GIVEN empty stdout WHEN handling ask THEN returns "(no output)" text', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 0,
        executionTimeMs: 100,
      });

      vi.mocked(stripAnsi).mockReturnValue('');

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: '(no output)' }],
      });
    });

    it('GIVEN output with ANSI codes WHEN handling ask THEN strips ANSI from output', async () => {
      const context = createContext();

      vi.mocked(stripAnsi).mockReturnValue('clean output');

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(stripAnsi).toHaveBeenCalledWith('command output');
      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'clean output' }],
      });
    });

    it('GIVEN working_directory arg WHEN handling ask THEN passes cwd to executeCommand', async () => {
      const context = createContext();

      await handleAsk(context, { prompt: 'test prompt', working_directory: '/home/user/project' });

      const call = vi.mocked(executeCommand).mock.calls[0]?.[0];

      expect(call?.cwd).toContain('project');
    });

    it('GIVEN files with working_directory WHEN handling ask THEN resolves files and passes them to buildArgArray', async () => {
      const context = createContext();

      await handleAsk(context, {
        prompt: 'test prompt',
        files: ['src/index.ts'],
        working_directory: '/home/user/project',
      });

      expect(buildArgArray).toHaveBeenCalledWith(
        context.config,
        expect.objectContaining({ files: [expect.stringContaining('index.ts')] }),
      );
    });
  });

  describe('command failure', () => {
    it('GIVEN command times out WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: null,
        signal: null,
        timedOut: true,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 0,
        executionTimeMs: 120_000,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.type).toBe('text');
      expect((result.content[0] as { text: string }).text).toContain('timed out');
    });

    it('GIVEN command killed by signal WHEN handling ask THEN returns isError response with signal info', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: null,
        signal: 'SIGKILL',
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 0,
        executionTimeMs: 500,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('SIGKILL');
    });

    it('GIVEN non-zero exit code WHEN handling ask THEN returns isError response with exit code', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: 'something went wrong',
        exitCode: 1,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 20,
        executionTimeMs: 200,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Exit code: 1');
    });

    it('GIVEN non-zero exit code with stderr WHEN handling ask THEN includes stderr in error response', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: 'fatal: unknown flag',
        exitCode: 2,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 19,
        executionTimeMs: 50,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('fatal: unknown flag');
    });
  });

  describe('validation errors', () => {
    it('GIVEN missing prompt WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      const result = await handleAsk(context, {});

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Prompt is required');
    });

    it('GIVEN empty prompt WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      const result = await handleAsk(context, { prompt: '' });

      expect(result.isError).toBe(true);
    });

    it('GIVEN invalid model WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      const result = await handleAsk(context, { prompt: 'test', model: '../../etc/passwd' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Invalid model identifier');
    });

    it('GIVEN invalid session_id WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      const result = await handleAsk(context, { prompt: 'test', session_id: '<script>alert(1)</script>' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Invalid session ID');
    });

    it('GIVEN files without working_directory WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      const result = await handleAsk(context, { prompt: 'test', files: ['file.txt'] });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('working_directory is required');
    });
  });

  describe('response text cap', () => {
    it('GIVEN output within MAX_RESPONSE_TEXT_BYTES WHEN handling ask THEN returns full output without truncation marker', async () => {
      const context = createContext();
      const shortOutput = 'a'.repeat(100);

      vi.mocked(stripAnsi).mockReturnValue(shortOutput);

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect((result.content[0] as { text: string }).text).toBe(shortOutput);
      expect((result.content[0] as { text: string }).text).not.toContain('[output truncated');
    });

    it('GIVEN output exceeding MAX_RESPONSE_TEXT_BYTES WHEN handling ask THEN truncates output and appends marker with byte count', async () => {
      const context = createContext();
      const largeOutput = 'b'.repeat(200 * 1024 + 500);

      vi.mocked(stripAnsi).mockReturnValue(largeOutput);

      const result = await handleAsk(context, { prompt: 'test prompt' });

      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('[output truncated —');
      expect(text).toContain('bytes total]');
      expect(text.length).toBeLessThan(largeOutput.length);
    });
  });

  describe('unexpected errors', () => {
    it('GIVEN executeCommand throws WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockRejectedValue(new Error('spawn ENOENT'));

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('spawn ENOENT');
    });

    it('GIVEN buildArgArray throws WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      vi.mocked(buildArgArray).mockImplementation(() => {
        throw new Error('arg builder failed');
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('arg builder failed');
    });
  });
});
