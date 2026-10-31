import type { CallToolResult } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler';
import { resetBackgroundJobStoreForTests } from '../../background-jobs/data-access';
import { buildArgArray } from '../../cli-args/domain-logic/arg.builder';
import { SESSION_STORE } from '../../session';
import type { SessionRecord, SessionTurn } from '../../session';
import type { McpPlainTextContent, ProgressContext, ResolvedProviderEntry } from '../../shared';
import { executeCommand } from '../../shared';
import { TEST_MINIMAL_ENV_STUB } from '../../shared/command-execution/test/stubs/env.stub';
import { ASK_STREAM_EVENT_SCHEMA, HEARTBEAT_IDLE_INTERVAL_MS } from '../../streaming/common';
import type { AskStreamEvent } from '../../streaming/common';
import type { AskToolArgs, ProgressNotification } from '../common';
import { ASK_DEFAULT_ARG_ARRAY_STUB } from '../test/stubs/ask-arg-array.stub';
import {
  ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB,
  ASK_SUCCESS_EXECUTION_RESULT_STUB,
} from '../test/stubs/ask-execution-result.stub';
import { createAskContext } from '../test/utils/ask-context.spec.util';
import { readFirstText } from '../test/utils/text-content.spec.util';

vi.mock('../../cli-args/domain-logic/arg.builder', () => {
  const result = {
    buildArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
  };

  return result;
});

vi.mock('../../shared/command-execution/domain-logic/command-executor', () => {
  const result = {
    executeCommand: vi.fn(async () => {
      await Promise.resolve();

      return ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB;
    }),
  };

  return result;
});

vi.mock('../../provider-metrics', () => {
  const result = {
    recordCall: vi.fn(async () => {
      await Promise.resolve();
    }),
  };

  return result;
});

vi.mock('../../shared/command-execution/domain-logic/platform', () => {
  const result = {
    buildMinimalEnv: vi.fn(() => TEST_MINIMAL_ENV_STUB),
  };

  return result;
});

vi.mock('../../shared/command-execution/utils/platform.util', () => {
  const result = {
    stripAnsi: vi.fn((input: string) => input),
  };

  return result;
});

type AsyncJobPayload = Readonly<Record<string, unknown>>;

const createProgressContext = (notifications: ProgressNotification[]): ProgressContext => {
  const sendNotification = vi.fn(async (notification: ProgressNotification) => {
    await Promise.resolve();
    notifications.push(notification);
  }) as unknown as ProgressContext['sendNotification'];

  const progressMeta = { progressToken: 'token-1' };
  const context: ProgressContext = {
    sendNotification,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _meta: progressMeta,
  };

  return context;
};

const parseEvents = (notifications: ProgressNotification[]): AskStreamEvent[] =>
  notifications.map((notification) => JSON.parse(notification.params.message) as AskStreamEvent);

const readAsyncJobPayload = (result: CallToolResult): AsyncJobPayload => {
  const payload = JSON.parse(readFirstText(result)) as AsyncJobPayload;

  return payload;
};

const readAsyncJobState = (payload: AsyncJobPayload): string | undefined => {
  const state = payload.state;

  if (typeof state !== 'string') return undefined;

  return state;
};

const TERMINAL_ASYNC_JOB_STATES = new Set(['completed', 'failed']);
const ASYNC_JOB_POLL_DELAY_MS = 10;
const ASYNC_JOB_MAX_POLL_ATTEMPTS = 20;

const isTerminalAsyncJobState = (state: string | undefined): boolean => {
  const result = state !== undefined && TERMINAL_ASYNC_JOB_STATES.has(state);

  return result;
};

const delay = async (durationMs: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
};

const fetchAsyncJobStatus = async (context: ResolvedProviderEntry, jobId: string): Promise<AsyncJobPayload> => {
  const statusResult = await handleAsk(context, { action: 'status', job_id: jobId });
  const statusPayload = readAsyncJobPayload(statusResult);

  return statusPayload;
};

const pollAsyncJobStatus = async (context: ResolvedProviderEntry, jobId: string): Promise<AsyncJobPayload> => {
  for (let attempt = 0; attempt < ASYNC_JOB_MAX_POLL_ATTEMPTS; attempt++) {
    const statusPayload = await fetchAsyncJobStatus(context, jobId);
    const state = readAsyncJobState(statusPayload);
    const isTerminal = isTerminalAsyncJobState(state);

    if (isTerminal) return statusPayload;

    await delay(ASYNC_JOB_POLL_DELAY_MS);
  }

  throw new Error(`Async job did not reach a terminal state within ${ASYNC_JOB_MAX_POLL_ATTEMPTS} attempts.`);
};

describe('handleAsk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    vi.mocked(executeCommand).mockResolvedValue(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB);

    resetBackgroundJobStoreForTests();
  });

  describe('session flow', () => {
    it('GIVEN include_structured is omitted WHEN handling session ask THEN prepends current request context without structuredContent', async () => {
      const context = createAskContext();
      const sessionId = 'ask-session-1';

      SESSION_STORE.createOrGet(context.name, sessionId);
      SESSION_STORE.addTurn(context.name, sessionId, { role: 'user', text: 'old question' });

      const result = await handleAsk(context, { prompt: 'test prompt', session_id: sessionId });
      const resolvedPrompt = vi.mocked(buildArgArray).mock.calls[0]?.[1]?.prompt;

      expect(result.content[0]).toStrictEqual({ type: 'text', text: 'command output' });
      expect(resolvedPrompt).toContain('Previous context:\nuser: old question');
      expect(resolvedPrompt).toContain('Current request:\ntest prompt');
      expect(result.structuredContent).toBeUndefined();
    });

    it('GIVEN include_structured is true WHEN handling session ask THEN returns session metadata in structuredContent', async () => {
      const context = createAskContext();
      const sessionId = 'ask-session-structured';

      SESSION_STORE.createOrGet(context.name, sessionId);
      SESSION_STORE.addTurn(context.name, sessionId, { role: 'user', text: 'old question' });

      const result = await handleAsk(context, {
        prompt: 'test prompt',
        session_id: sessionId,
        include_structured: true,
      });

      const attribution = {
        provider: 'test',
        executionTimeMs: 100,
        outputBytes: 14,
        truncated: false,
        outputFormat: 'json',
        sessionMode: 'tier1-prepend',
      };

      expect(result.structuredContent).toMatchObject({
        response: 'command output',
        attribution,
        sessionMode: 'tier1-prepend',
      });
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

    it('GIVEN isError response WHEN handling session ask THEN does not store session turns', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        stderr: 'command failed',
        exitCode: 1,
        stderrBytes: 14,
        executionTimeMs: 100,
      });

      await handleAsk(context, { prompt: 'fail me', session_id: 'ask-session-error' });

      const stored = SESSION_STORE.get(context.name, 'ask-session-error');

      expect(stored?.turns).toStrictEqual([]);
    });

    it('GIVEN session call completes WHEN next call uses same session_id THEN lock is released and call succeeds', async () => {
      const context = createAskContext();
      const sessionId = 'ask-session-lock-release';

      await handleAsk(context, { prompt: 'first call', session_id: sessionId });

      const result = await handleAsk(context, { prompt: 'second call', session_id: sessionId });

      expect(result.isError).not.toBe(true);
    });
  });

  describe('async jobs', () => {
    it('GIVEN mode async WHEN handling ask THEN returns job_id with pending state', async () => {
      const context = createAskContext();

      const result = await handleAsk(context, { prompt: 'x', mode: 'async' });
      const payload = JSON.parse(readFirstText(result)) as AsyncJobPayload;

      expect(payload.job_id).toBeDefined();
      expect(payload.state).toBe('pending');
    });

    it('GIVEN completed async job WHEN polling status THEN returns completed with final output', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'completed output',
        stdoutBytes: 16,
      });

      const startResult = await handleAsk(context, { prompt: 'x', mode: 'async' });
      const startPayload = readAsyncJobPayload(startResult);
      const jobId = startPayload.job_id as string | undefined;

      expect(jobId).toBeDefined();

      if (!jobId) throw new Error('job_id should be present');

      const statusPayload = await pollAsyncJobStatus(context, jobId);

      expect(statusPayload.state).toBe('completed');
      expect(statusPayload.result).toBe('completed output');
      expect(statusPayload.structuredContent).toBeUndefined();
    });

    it('GIVEN include_structured is true for async ask WHEN polling status THEN returns structured payload', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'completed output',
        stdoutBytes: 16,
      });

      const startResult = await handleAsk(context, { prompt: 'x', mode: 'async', include_structured: true });
      const startPayload = readAsyncJobPayload(startResult);
      const jobId = startPayload.job_id as string | undefined;

      expect(jobId).toBeDefined();

      if (!jobId) throw new Error('job_id should be present');

      const statusPayload = await pollAsyncJobStatus(context, jobId);

      expect(statusPayload.state).toBe('completed');
      const attribution = {
        provider: 'test',
        executionTimeMs: 100,
        outputBytes: 16,
        truncated: false,
        outputFormat: 'json',
      };

      expect(statusPayload.structuredContent).toMatchObject({
        response: 'completed output',
        attribution,
      });
    });
  });

  describe('streaming', () => {
    it('GIVEN stream_live true and progressToken WHEN stdout chunks arrive THEN emits start chunk done events in order', async () => {
      const context = createAskContext();
      const notifications: ProgressNotification[] = [];
      const extra = createProgressContext(notifications);

      vi.mocked(executeCommand).mockImplementation(async (options) => {
        await Promise.resolve();
        options.onStdoutChunk?.('hello');

        const result = { ...ASK_SUCCESS_EXECUTION_RESULT_STUB, stdout: 'hello', stdoutBytes: 5 };

        return result;
      });

      await handleAsk(context, { prompt: 'x', stream_live: true }, extra);

      const events = parseEvents(notifications);
      const eventTypes = events.map((event) => event.type);

      expect(eventTypes[0]).toBe('start');
      expect(eventTypes.at(-1)).toBe('done');
      expect(eventTypes.filter((type) => type === 'chunk').length).toBeGreaterThan(0);
      expect(events[0]?.schema).toBe(ASK_STREAM_EVENT_SCHEMA);
      expect(events.map((event) => event.sequence)).toStrictEqual(
        Array.from({ length: events.length }, (_, index) => index + 1)
      );
    });

    it('GIVEN stream_live true WHEN chunk emitted recently THEN idle heartbeat is skipped', async () => {
      vi.useFakeTimers();

      const context = createAskContext();
      const notifications: ProgressNotification[] = [];
      const extra = createProgressContext(notifications);

      vi.mocked(executeCommand).mockImplementation(async (options) => {
        await Promise.resolve();
        options.onStdoutChunk?.('hello');

        const result = { ...ASK_SUCCESS_EXECUTION_RESULT_STUB, stdout: 'hello', stdoutBytes: 5 };

        return result;
      });

      const args: AskToolArgs = { prompt: 'x', stream_live: true };

      await handleAsk(context, args, extra);

      vi.advanceTimersByTime(HEARTBEAT_IDLE_INTERVAL_MS + 10);

      const events = parseEvents(notifications);
      const heartbeatEvents = events.filter((event) => event.type === 'heartbeat');

      expect(heartbeatEvents).toHaveLength(0);
    });
  });
});
