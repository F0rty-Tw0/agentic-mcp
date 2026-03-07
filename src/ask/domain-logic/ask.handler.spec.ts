import type { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler';
import { buildArgArray } from '../../cli-args/domain-logic/arg.builder';
import type { McpPlainTextContent, ProgressContext, ResolvedProviderEntry } from '../../shared';
import {
  DEFAULT_MCP_TOOL_TIMEOUT_MS,
  TEST_MINIMAL_ENV_STUB,
  buildMinimalEnv,
  executeCommand,
  getActiveRequest,
  stripAnsi,
} from '../../shared';
import {
  ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB,
  ASK_DEFAULT_ARG_ARRAY_STUB,
  ASK_STDIN_ARG_ARRAY_STUB,
  ASK_SUCCESS_EXECUTION_RESULT_STUB,
  createAskContext,
} from '../common/stubs';

type ProgressNotificationMockCalls = Array<[ServerNotification & { params?: { message?: string } }]>;

vi.mock('../../cli-args/domain-logic/arg.builder', () => ({
  buildArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
}));

vi.mock('../../shared/command-execution/domain-logic/command-executor', () => ({
  executeCommand: vi.fn(async () => Promise.resolve(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB)),
}));

vi.mock('../../shared/command-execution/utils/platform.util', () => ({
  buildMinimalEnv: vi.fn(() => TEST_MINIMAL_ENV_STUB),
  stripAnsi: vi.fn((input: string) => input),
}));

vi.mock('../../shared/provider/utils/model-error.util', () => ({
  detectModelError: vi.fn(() => false),
  extractAttemptedModel: vi.fn(() => undefined),
  fetchAvailableModels: vi.fn().mockResolvedValue(undefined),
  buildModelHint: vi.fn(() => ''),
}));

const API_KEY = 'API_KEY';
const MCP_TOOL_TIMEOUT = 'MCP_TOOL_TIMEOUT';

describe('handleAsk', () => {
  const createProgressContext = (): ProgressContext => {
    const context: ProgressContext = {
      sendNotification: vi.fn(async () => {
        await Promise.resolve();
      }),
    };

    // eslint-disable-next-line no-underscore-dangle
    context._meta = { progressToken: 'token-1' };

    return context;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(buildArgArray).mockReturnValue(ASK_DEFAULT_ARG_ARRAY_STUB);

    vi.mocked(executeCommand).mockResolvedValue(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB);

    vi.mocked(buildMinimalEnv).mockReturnValue(TEST_MINIMAL_ENV_STUB);
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
  });

  describe('successful execution', () => {
    it('GIVEN valid prompt WHEN handling ask THEN returns text content with command output', async () => {
      const context = createAskContext();

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.content[0]).toStrictEqual({ type: 'text', text: 'command output' });
      expect(result.content).toHaveLength(2);
    });

    it('GIVEN valid prompt WHEN handling ask THEN calls buildArgArray with config and resolved args', async () => {
      const context = createAskContext();

      await handleAsk(context, { prompt: 'test prompt' });

      expect(buildArgArray).toHaveBeenCalledWith(context.config, expect.objectContaining({ prompt: 'test prompt' }));
    });

    it('GIVEN provider env without MCP_TOOL_TIMEOUT WHEN handling ask THEN injects default timeout env', async () => {
      const context = createAskContext({ env: { [API_KEY]: 'secret' } });

      await handleAsk(context, { prompt: 'test prompt' });

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        [API_KEY]: 'secret',
        [MCP_TOOL_TIMEOUT]: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
    });

    it('GIVEN provider without MCP_TOOL_TIMEOUT WHEN handling ask THEN injects default timeout env', async () => {
      const context: ResolvedProviderEntry = {
        ...createAskContext({ env: { [API_KEY]: 'secret' } }),
        name: 'codex',
      };

      await handleAsk(context, { prompt: 'test prompt' });

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        [API_KEY]: 'secret',
        [MCP_TOOL_TIMEOUT]: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
    });

    it('GIVEN valid prompt WHEN handling ask THEN calls executeCommand with correct options', async () => {
      const context = createAskContext();

      await handleAsk(context, { prompt: 'test prompt' });

      expect(executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          binaryPath: '/usr/bin/test-cli',
          args: ['exec', 'test prompt'],
          env: TEST_MINIMAL_ENV_STUB,
          timeoutMs: 120_000,
          stdin: undefined,
          cwd: undefined,
        })
      );
    });

    it('GIVEN stdin input method WHEN handling ask THEN passes stdinInput to executeCommand', async () => {
      const context = createAskContext({ input: { method: 'stdin' } });

      vi.mocked(buildArgArray).mockReturnValue(ASK_STDIN_ARG_ARRAY_STUB);

      await handleAsk(context, { prompt: 'test prompt' });

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({ stdin: 'test prompt' }));
    });

    it('GIVEN empty stdout WHEN handling ask THEN returns "(no output)" text', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
      });

      vi.mocked(stripAnsi).mockReturnValue('');

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.content[0]).toStrictEqual({ type: 'text', text: '(no output)' });
      expect(result.content).toHaveLength(2);
    });

    it('GIVEN output with ANSI codes WHEN handling ask THEN strips ANSI from output', async () => {
      const context = createAskContext();

      vi.mocked(stripAnsi).mockReturnValue('clean output');

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(stripAnsi).toHaveBeenCalledWith('command output');
      expect(result.content[0]).toStrictEqual({ type: 'text', text: 'clean output' });
      expect(result.content).toHaveLength(2);
    });

    it('GIVEN working_directory arg WHEN handling ask THEN passes cwd to executeCommand', async () => {
      const context = createAskContext();

      await handleAsk(context, { prompt: 'test prompt', working_directory: '/home/user/project' });

      const call = vi.mocked(executeCommand).mock.calls[0]?.[0];

      expect(call?.cwd).toContain('project');
    });

    it('GIVEN files with working_directory WHEN handling ask THEN resolves files and passes them to buildArgArray', async () => {
      const context = createAskContext();

      await handleAsk(context, {
        prompt: 'test prompt',
        files: ['src/'],
        working_directory: '/home/user/project',
      });

      expect(buildArgArray).toHaveBeenCalledWith(
        context.config,
        expect.objectContaining({ files: [expect.stringContaining('')] })
      );
    });

    it('GIVEN stream_live false WHEN handling ask THEN chunk stream notifications are not emitted', async () => {
      const context = createAskContext();
      const extra = createProgressContext();

      vi.mocked(executeCommand).mockImplementation(async (options) => {
        await Promise.resolve();
        options.onStdoutChunk?.('chunk-data');

        return {
          ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
          stdout: 'chunk-data',
          stdoutBytes: 10,
        };
      });

      await handleAsk(context, { prompt: 'test prompt', stream_live: false }, extra);

      const calls = vi.mocked(extra.sendNotification).mock.calls as ProgressNotificationMockCalls;
      const serializedMessages = calls.map(([notification]) => notification.params?.message ?? '').join(' ');

      expect(serializedMessages).not.toContain('"type":"chunk"');
    });

    it('GIVEN stream_live true WHEN command completes THEN still returns final CallToolResult text output', async () => {
      const context = createAskContext();
      const extra = createProgressContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'command output',
        stdoutBytes: 14,
      });

      const result = await handleAsk(context, { prompt: 'x', stream_live: true }, extra);

      expect(result.content[0]).toStrictEqual({ type: 'text', text: 'command output' });
    });
  });

  describe('response text cap', () => {
    it('GIVEN output within MAX_RESPONSE_TEXT_BYTES WHEN handling ask THEN returns full output without truncation marker', async () => {
      const context = createAskContext();
      const shortOutput = 'a'.repeat(100);

      vi.mocked(stripAnsi).mockReturnValue(shortOutput);

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect((result.content[0] as McpPlainTextContent).text).toBe(shortOutput);
      expect((result.content[0] as McpPlainTextContent).text).not.toContain('[output truncated');
    });

    it('GIVEN output exceeding MAX_RESPONSE_TEXT_BYTES WHEN handling ask THEN truncates output and appends marker with byte count', async () => {
      const context = createAskContext();
      const largeOutput = 'b'.repeat(200 * 1024 + 500);

      vi.mocked(stripAnsi).mockReturnValue(largeOutput);

      const result = await handleAsk(context, { prompt: 'test prompt' });

      const text = (result.content[0] as McpPlainTextContent).text;

      expect(text).toContain('[output truncated —');
      expect(text).toContain('bytes total]');
      expect(text.length).toBeLessThan(largeOutput.length);
    });
  });

  describe('request tracking', () => {
    it('GIVEN requestId and spawned process WHEN command completes THEN active request is cleaned up', async () => {
      const context = createAskContext();
      const extra: ProgressContext = {
        sendNotification: vi.fn(async () => Promise.resolve()),
        requestId: 'req-1',
      };

      vi.mocked(executeCommand).mockImplementation(async (options) => {
        await Promise.resolve();
        options.onSpawned?.(777);

        return ASK_SUCCESS_EXECUTION_RESULT_STUB;
      });

      await handleAsk(context, { prompt: 'track process' }, extra);

      expect(getActiveRequest('req-1')).toBeUndefined();
    });
  });
});
