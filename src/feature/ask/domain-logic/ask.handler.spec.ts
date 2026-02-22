/* eslint-disable @typescript-eslint/naming-convention */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler.ts';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../../shared/common/index.ts';
import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/common/index.ts';
import { ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB, ASK_DEFAULT_ARG_ARRAY_STUB, ASK_PROVIDER_CONFIG_STUB,
ASK_RESOLVED_PROVIDER_ENTRY_STUB, ASK_STDIN_ARG_ARRAY_STUB , ASK_SUCCESS_EXECUTION_RESULT_STUB , ASK_TEST_ENV_STUB } from '../common/stubs/index.ts';

vi.mock('./arg.builder.ts', () => ({
  buildArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
}));

vi.mock('../../../shared/domain-logic/command-executor.ts', () => ({
  executeCommand: vi.fn(async () => Promise.resolve(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB)),
}));

vi.mock('../../../shared/utils/platform.util.ts', () => ({
  buildMinimalEnv: vi.fn(() => ASK_TEST_ENV_STUB),
  stripAnsi: vi.fn((input: string) => input),
}));

// Real validation — no mock (validates real behaviour)
// Real toMcpError — no mock (validates real error mapping)

const { buildArgArray } = await import('./arg.builder.ts');
const { executeCommand } = await import('../../../shared/domain-logic/command-executor.ts');
const { buildMinimalEnv, stripAnsi } = await import('../../../shared/utils/platform.util.ts');

const createContext = (overrides: Partial<ProviderConfig> = {}): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    ...ASK_PROVIDER_CONFIG_STUB,
    ...overrides,
  };

  const context: ResolvedProviderEntry = {
    ...ASK_RESOLVED_PROVIDER_ENTRY_STUB,
    config,
  };

  return context;
};

describe('handleAsk', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(buildArgArray).mockReturnValue(ASK_DEFAULT_ARG_ARRAY_STUB);

    vi.mocked(executeCommand).mockResolvedValue(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB);

    vi.mocked(buildMinimalEnv).mockReturnValue(ASK_TEST_ENV_STUB);
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

      vi.mocked(buildArgArray).mockReturnValue(ASK_STDIN_ARG_ARRAY_STUB);

      await handleAsk(context, { prompt: 'test prompt' });

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({ stdin: 'test prompt' }));
    });

    it('GIVEN empty stdout WHEN handling ask THEN returns "(no output)" text', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
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
