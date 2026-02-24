import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleHelp } from './help.handler.ts';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../shared/common/index.ts';
import type { ResolvedProviderEntry } from '../../shared/common/index.ts';
import {
  SIMPLE_TOOLS_HELP_OUTPUT_RESULT_STUB,
  SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
  SIMPLE_TOOLS_TEST_ENV_STUB,
  createSimpleToolsContext,
} from '../common/stubs/index.ts';

vi.mock('../../shared/domain-logic/command-executor.ts', () => ({
  executeCommand: vi.fn(async () => Promise.resolve(SIMPLE_TOOLS_HELP_OUTPUT_RESULT_STUB)),
}));

vi.mock('../../shared/utils/platform.util.ts', () => ({
  buildMinimalEnv: vi.fn(() => SIMPLE_TOOLS_TEST_ENV_STUB),
  stripAnsi: vi.fn((input: string) => input),
}));

// Real toMcpError — no mock (validates real error mapping)

const { executeCommand } = await import('../../shared/domain-logic/command-executor.ts');
const { buildMinimalEnv, stripAnsi } = await import('../../shared/utils/platform.util.ts');

describe('handleHelp', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(executeCommand).mockResolvedValue(SIMPLE_TOOLS_HELP_OUTPUT_RESULT_STUB);

    vi.mocked(buildMinimalEnv).mockReturnValue(SIMPLE_TOOLS_TEST_ENV_STUB);
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
  });

  describe('successful execution', () => {
    it('GIVEN provider context WHEN handling help THEN returns text content with help output', async () => {
      const context = createSimpleToolsContext();

      const result = await handleHelp(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'Usage: test-cli [options]' }],
      });
    });

    it('GIVEN provider env without MCP_TOOL_TIMEOUT WHEN handling help THEN injects default timeout env', async () => {
      const context = createSimpleToolsContext({ env: { apiKey: 'secret' } });

      await handleHelp(context);

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        apiKey: 'secret',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        MCP_TOOL_TIMEOUT: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
    });

    it('GIVEN provider without MCP_TOOL_TIMEOUT WHEN handling help THEN injects default timeout env', async () => {
      const context: ResolvedProviderEntry = {
        ...createSimpleToolsContext({ env: { apiKey: 'secret' } }),
        name: 'opencode',
      };

      await handleHelp(context);

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        apiKey: 'secret',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        MCP_TOOL_TIMEOUT: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
    });

    it('GIVEN provider context WHEN handling help THEN calls executeCommand with --help flag and 10s timeout', async () => {
      const context = createSimpleToolsContext();

      await handleHelp(context);

      expect(executeCommand).toHaveBeenCalledWith({
        binaryPath: '/usr/bin/test-cli',
        args: ['--help'],
        env: { PATH: '/usr/bin' },
        timeoutMs: 10_000,
        bypassSemaphore: true,
      });
    });

    it('GIVEN output with ANSI codes WHEN handling help THEN strips ANSI from output', async () => {
      const context = createSimpleToolsContext();

      vi.mocked(stripAnsi).mockReturnValue('clean help output');

      const result = await handleHelp(context);

      expect(stripAnsi).toHaveBeenCalledWith('Usage: test-cli [options]');
      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'clean help output' }],
      });
    });

    it('GIVEN output with whitespace WHEN handling help THEN trims the output', async () => {
      const context = createSimpleToolsContext();

      vi.mocked(stripAnsi).mockReturnValue('  help output  ');

      const result = await handleHelp(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'help output' }],
      });
    });
  });

  describe('stderr fallback', () => {
    it('GIVEN empty stdout WHEN handling help THEN falls back to stderr', async () => {
      const context = createSimpleToolsContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        stderr: 'Usage from stderr',
        stderrBytes: 17,
      });

      await handleHelp(context);

      expect(stripAnsi).toHaveBeenCalledWith('Usage from stderr');
    });

    it('GIVEN both stdout and stderr WHEN handling help THEN prefers stdout', async () => {
      const context = createSimpleToolsContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'stdout help',
        stderr: 'stderr help',
        stdoutBytes: 11,
        stderrBytes: 11,
      });

      await handleHelp(context);

      expect(stripAnsi).toHaveBeenCalledWith('stdout help');
    });
  });

  describe('non-zero exit code', () => {
    it('GIVEN CLI exits non-zero for --help WHEN handling help THEN still returns output (not error)', async () => {
      const context = createSimpleToolsContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'Usage: stubborn-cli [options]',
        exitCode: 1,
        stdoutBytes: 28,
      });

      const result = await handleHelp(context);

      expect(result.isError).toBeUndefined();
      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'Usage: stubborn-cli [options]' }],
      });
    });
  });

  describe('unexpected errors', () => {
    it('GIVEN executeCommand throws WHEN handling help THEN returns isError response', async () => {
      const context = createSimpleToolsContext();

      vi.mocked(executeCommand).mockRejectedValue(new Error('spawn ENOENT'));

      const result = await handleHelp(context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('spawn ENOENT');
    });

    it('GIVEN buildMinimalEnv throws WHEN handling help THEN returns isError response', async () => {
      const context = createSimpleToolsContext();

      vi.mocked(buildMinimalEnv).mockImplementation(() => {
        throw new Error('env construction failed');
      });

      const result = await handleHelp(context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('env construction failed');
    });
  });
});
