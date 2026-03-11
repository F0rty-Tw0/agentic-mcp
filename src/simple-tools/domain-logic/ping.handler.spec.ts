import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handlePing } from './ping.handler';
import type { McpPlainTextContent, ResolvedProviderEntry } from '../../shared';
import {
  DEFAULT_MCP_TOOL_TIMEOUT_MS,
  TEST_MINIMAL_ENV_STUB,
  buildMinimalEnv,
  executeCommand,
  stripAnsi,
} from '../../shared';
import {
  SIMPLE_TOOLS_PING_VERSION_RESULT_STUB,
  SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
  createSimpleToolsContext,
} from '../common/stubs';

vi.mock('../../shared/command-execution/domain-logic/command-executor', () => ({
  executeCommand: vi.fn(async () => Promise.resolve(SIMPLE_TOOLS_PING_VERSION_RESULT_STUB)),
}));

vi.mock('../../shared/command-execution/utils/platform.util', () => ({
  buildMinimalEnv: vi.fn(() => TEST_MINIMAL_ENV_STUB),
  stripAnsi: vi.fn((input: string) => input),
}));

type VersionCheckFailure = Readonly<{
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
}>;

const createAskProofMessage = (providerName: string): string => {
  return `Run ask_${providerName} to prove authentication and a real response.`;
};

const createBinaryDetectedText = (providerName: string): string => {
  return `${providerName}: binary detected at /usr/bin/test-cli. This only proves the CLI is installed. ${createAskProofMessage(providerName)}`;
};

const createVersionSucceededText = (providerName: string, version: string): string => {
  return `${providerName}: version check succeeded (version: ${version}). This does not prove authentication or a successful ask. ${createAskProofMessage(providerName)}`;
};

const createVersionFailedText = (providerName: string, input: VersionCheckFailure): string => {
  const { exitCode, signal, timedOut } = input;

  return `${providerName}: version check failed (exit ${exitCode}, signal: ${signal}, timedOut: ${String(timedOut)}). Fix the CLI, then rerun ping_${providerName} before ask_${providerName}.`;
};

describe('handlePing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(executeCommand).mockResolvedValue(SIMPLE_TOOLS_PING_VERSION_RESULT_STUB);

    vi.mocked(buildMinimalEnv).mockReturnValue(TEST_MINIMAL_ENV_STUB);
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
  });

  describe('no versionCheck configured', () => {
    it('GIVEN provider without versionCheck WHEN handling ping THEN returns binary-detected guidance', async () => {
      const context = createSimpleToolsContext();

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: createBinaryDetectedText('test') }],
      });
    });

    it('GIVEN provider without versionCheck WHEN handling ping THEN does not call executeCommand', async () => {
      const context = createSimpleToolsContext();

      await handlePing(context);

      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('successful version check', () => {
    it('GIVEN provider with versionCheck WHEN command succeeds THEN returns scope-limited success wording', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '--version' } });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: createVersionSucceededText('test', 'v1.0.0') }],
      });
    });

    it('GIVEN provider with versionCheck WHEN handling ping THEN calls executeCommand with correct args and 30s timeout', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '--version' } });

      await handlePing(context);

      expect(executeCommand).toHaveBeenCalledWith({
        binaryPath: '/usr/bin/test-cli',
        args: ['--version'],
        env: TEST_MINIMAL_ENV_STUB,
        timeoutMs: 30_000,
        bypassSemaphore: true,
      });
    });

    it('GIVEN provider env without MCP_TOOL_TIMEOUT WHEN handling ping THEN injects default timeout env', async () => {
      const context = createSimpleToolsContext({
        versionCheck: { flag: '--version' },
        env: { apiKey: 'secret' },
      });

      await handlePing(context);

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        apiKey: 'secret',
        ['MCP_TOOL_TIMEOUT']: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
    });

    it('GIVEN named provider without MCP_TOOL_TIMEOUT WHEN handling ping THEN keeps the provider-specific ask step', async () => {
      const context: ResolvedProviderEntry = {
        ...createSimpleToolsContext({
          versionCheck: { flag: '--version' },
          env: { apiKey: 'secret' },
        }),
        name: 'gemini',
      };

      const result = await handlePing(context);

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        apiKey: 'secret',
        ['MCP_TOOL_TIMEOUT']: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
      expect((result.content[0] as McpPlainTextContent).text).toContain('Run ask_gemini');
    });

    it('GIVEN output with ANSI codes WHEN handling ping THEN strips ANSI from output', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '--version' } });

      vi.mocked(stripAnsi).mockReturnValue('v2.0.0');

      const result = await handlePing(context);

      expect(stripAnsi).toHaveBeenCalledWith('v1.0.0');
      expect(result).toStrictEqual({
        content: [{ type: 'text', text: createVersionSucceededText('test', 'v2.0.0') }],
      });
    });

    it('GIVEN output with whitespace WHEN handling ping THEN trims the output', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '  v1.0.0  ',
        stdoutBytes: 10,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: createVersionSucceededText('test', 'v1.0.0') }],
      });
    });
  });

  describe('version pattern extraction', () => {
    it('GIVEN versionCheck with pattern WHEN output matches THEN extracts first capture group', async () => {
      const context = createSimpleToolsContext({
        versionCheck: { flag: '--version', pattern: 'v(\\d+\\.\\d+\\.\\d+)' },
      });

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'test-cli v3.2.1 (build 42)',
        stdoutBytes: 26,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: createVersionSucceededText('test', '3.2.1') }],
      });
    });

    it('GIVEN versionCheck with pattern WHEN output does not match THEN returns raw output', async () => {
      const context = createSimpleToolsContext({
        versionCheck: { flag: '--version', pattern: 'version (\\d+)' },
      });

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'no match here',
        stdoutBytes: 13,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: createVersionSucceededText('test', 'no match here') }],
      });
    });

    it('GIVEN versionCheck without pattern WHEN command succeeds THEN returns full output as version', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '-V' } });

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'test-cli 4.5.6',
        stdoutBytes: 14,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: createVersionSucceededText('test', 'test-cli 4.5.6') }],
      });
    });
  });

  describe('command failure', () => {
    it('GIVEN command times out WHEN handling ping THEN returns truthful failure guidance', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        exitCode: null,
        signal: 'SIGTERM',
        timedOut: true,
        executionTimeMs: 10_000,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [
          {
            type: 'text',
            text: createVersionFailedText('test', { exitCode: null, signal: 'SIGTERM', timedOut: true }),
          },
        ],
      });
    });

    it('GIVEN command exits non-zero WHEN handling ping THEN returns truthful failure guidance', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        stderr: 'error',
        exitCode: 1,
        stderrBytes: 5,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [
          {
            type: 'text',
            text: createVersionFailedText('test', { exitCode: 1, signal: null, timedOut: false }),
          },
        ],
      });
    });

    it('GIVEN command killed by signal WHEN handling ping THEN returns truthful failure guidance', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockResolvedValue({
        ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        exitCode: null,
        signal: 'SIGKILL',
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [
          {
            type: 'text',
            text: createVersionFailedText('test', { exitCode: null, signal: 'SIGKILL', timedOut: false }),
          },
        ],
      });
    });
  });

  describe('unexpected errors', () => {
    it('GIVEN executeCommand throws WHEN handling ping THEN returns isError response', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockRejectedValue(new Error('spawn ENOENT'));

      const result = await handlePing(context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('spawn ENOENT');
    });

    it('GIVEN buildMinimalEnv throws WHEN handling ping THEN returns isError response', async () => {
      const context = createSimpleToolsContext({ versionCheck: { flag: '--version' } });

      vi.mocked(buildMinimalEnv).mockImplementation(() => {
        throw new Error('env construction failed');
      });

      const result = await handlePing(context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('env construction failed');
    });
  });
});
