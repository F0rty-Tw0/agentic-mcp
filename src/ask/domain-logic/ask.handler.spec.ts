import type { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler';
import { buildArgArray } from '../../cli-args/domain-logic/arg.builder';
import { SESSION_STORE } from '../../session';
import type { SessionRecord, SessionTurn } from '../../session';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../shared/common';
import type { McpPlainTextContent, McpTextContent, ProgressContext, ResolvedProviderEntry } from '../../shared/common';
import { TEST_MINIMAL_ENV_STUB } from '../../shared/common/stubs';
import { executeCommand } from '../../shared/domain-logic/command-executor';
import { getActiveRequest } from '../../shared/domain-logic/request-registry';
import { buildMinimalEnv, stripAnsi } from '../../shared/utils/platform.util';
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

vi.mock('../../shared/domain-logic/command-executor', () => ({
  executeCommand: vi.fn(async () => Promise.resolve(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB)),
}));

vi.mock('../../shared/utils/platform.util', () => ({
  buildMinimalEnv: vi.fn(() => TEST_MINIMAL_ENV_STUB),
  stripAnsi: vi.fn((input: string) => input),
}));

// Real validation — no mock (validates real behaviour)
// Real toMcpError — no mock (validates real error mapping)

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

  describe('validation errors', () => {
    it('GIVEN missing prompt WHEN handling ask THEN returns isError response', async () => {
      const context = createAskContext();

      const result = await handleAsk(context, {});

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('Prompt is required');
    });

    it('GIVEN empty prompt WHEN handling ask THEN returns isError response', async () => {
      const context = createAskContext();

      const result = await handleAsk(context, { prompt: '' });

      expect(result.isError).toBe(true);
    });

    it('GIVEN invalid model WHEN handling ask THEN returns isError response', async () => {
      const context = createAskContext();

      const result = await handleAsk(context, { prompt: 'test', model: '../../etc/passwd' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('Invalid model identifier');
    });

    it('GIVEN invalid session_id WHEN handling ask THEN returns isError response', async () => {
      const context = createAskContext();

      const result = await handleAsk(context, { prompt: 'test', session_id: '<script>alert(1)</script>' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('Invalid session ID');
    });

    it('GIVEN files without working_directory WHEN handling ask THEN returns isError response', async () => {
      const context = createAskContext();

      const result = await handleAsk(context, { prompt: 'test', files: ['file.txt'] });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('working_directory is required');
    });
  });

  describe('session flow', () => {
    it('GIVEN session_id WHEN handling ask THEN prepends current request context and returns session metadata block', async () => {
      const context = createAskContext();
      const sessionId = 'ask-session-1';

      SESSION_STORE.createOrGet(context.name, sessionId);
      SESSION_STORE.addTurn(context.name, sessionId, { role: 'user', text: 'old question' });

      const result = await handleAsk(context, { prompt: 'test prompt', session_id: sessionId });
      const resolvedArgs = vi.mocked(buildArgArray).mock.calls[0]?.[1] as { prompt: string };
      const sessionMetadataContent = result.content[2] as McpTextContent;
      const sessionMetadataText = sessionMetadataContent.text;

      expect(sessionMetadataContent.type).toBe('text');
      expect(resolvedArgs.prompt).toContain('Previous context:\nuser: old question');
      expect(resolvedArgs.prompt).toContain('Current request:\ntest prompt');
      expect(sessionMetadataText).toContain('tier1-prepend');
    });

    it('GIVEN session lock already acquired WHEN handling ask THEN returns session in use error', async () => {
      const context = createAskContext();

      SESSION_STORE.createOrGet(context.name, 'ask-session-locked');
      SESSION_STORE.tryAcquireLock(context.name, 'ask-session-locked');

      const result = await handleAsk(context, { prompt: 'test prompt', session_id: 'ask-session-locked' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('session in use');

      SESSION_STORE.releaseLock(context.name, 'ask-session-locked');
    });

    it('GIVEN successful session call WHEN handling ask THEN stores user and assistant turns', async () => {
      const context = createAskContext();
      const sessionId = 'ask-session-memory';

      await handleAsk(context, { prompt: 'remember this', session_id: sessionId });

      const stored = SESSION_STORE.get(context.name, sessionId) as SessionRecord;
      const firstTurn = stored.turns[0] as SessionTurn;
      const secondTurn = stored.turns[1] as SessionTurn;

      expect(stored).toBeDefined();

      expect(stored.turns).toHaveLength(2);
      expect(firstTurn.role).toBe('user');
      expect(secondTurn.role).toBe('assistant');
      expect(secondTurn.text).toContain('command output');
    });

    it('GIVEN cancelled session execution WHEN handling ask THEN it does not store session turns', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        exitCode: null,
        signal: 'SIGTERM',
      });

      await handleAsk(context, { prompt: 'cancel me', session_id: 'ask-session-cancelled' });

      const stored = SESSION_STORE.get(context.name, 'ask-session-cancelled');

      expect(stored?.turns).toStrictEqual([]);
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
