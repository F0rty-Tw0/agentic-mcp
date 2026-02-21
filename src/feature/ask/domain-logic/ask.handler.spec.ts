/* eslint-disable @typescript-eslint/naming-convention */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler.ts';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../../shared/common/execution-limits.const.ts';
import type { ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/provider-config.type.ts';

vi.mock('./arg.builder.ts', () => ({
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
    })
  ),
}));

vi.mock('../../../shared/utils/platform.util.ts', () => ({
  buildMinimalEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
  stripAnsi: vi.fn((input: string) => input),
}));

// Real validation — no mock (validates real behaviour)
// Real toMcpError — no mock (validates real error mapping)

const { buildArgArray } = await import('./arg.builder.ts');
const { executeCommand } = await import('../../../shared/domain-logic/command-executor.ts');
const { buildMinimalEnv, stripAnsi } = await import('../../../shared/utils/platform.util.ts');

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

    it('GIVEN provider env without MCP_TOOL_TIMEOUT WHEN handling ask THEN injects default timeout env', async () => {
      const context = createContext({ env: { API_KEY: 'secret' } });

      await handleAsk(context, { prompt: 'test prompt' });

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        API_KEY: 'secret',
        MCP_TOOL_TIMEOUT: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
    });

    it('GIVEN provider without MCP_TOOL_TIMEOUT WHEN handling ask THEN injects default timeout env', async () => {
      const context: ResolvedProviderEntry = {
        ...createContext({ env: { API_KEY: 'secret' } }),
        name: 'codex',
      };

      await handleAsk(context, { prompt: 'test prompt' });

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        API_KEY: 'secret',
        MCP_TOOL_TIMEOUT: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
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
        expect.objectContaining({ files: [expect.stringContaining('index.ts')] })
      );
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
});
