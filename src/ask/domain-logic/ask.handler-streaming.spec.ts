import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler';
import type { ProgressContext } from "../../shared/common";
import { ASK_STREAM_EVENT_SCHEMA, HEARTBEAT_IDLE_INTERVAL_MS } from "../common";
import type { AskStreamEvent, AskToolArgs } from "../common";
import {
  ASK_DEFAULT_ARG_ARRAY_STUB,
  ASK_SUCCESS_EXECUTION_RESULT_STUB,
  ASK_TEST_ENV_STUB,
  createAskContext,
} from "../common/stubs";

vi.mock('../args/domain-logic/arg.builder', () => ({
  buildArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
}));

vi.mock('../../shared/domain-logic/command-executor', () => ({
  executeCommand: vi.fn(async () => {
    await Promise.resolve();

    return ASK_SUCCESS_EXECUTION_RESULT_STUB;
  }),
}));

vi.mock('../../shared/utils/platform.util', () => ({
  buildMinimalEnv: vi.fn(() => ASK_TEST_ENV_STUB),
  stripAnsi: vi.fn((input: string) => input),
}));

const { executeCommand } = await import('../../shared/domain-logic/command-executor');

type ProgressNotification = Readonly<{
  method: string;
  params: Readonly<{ message: string }>;
}>;

const createProgressContext = (notifications: ProgressNotification[]): ProgressContext => {
  const sendNotification = vi.fn(async (notification: ProgressNotification) => {
    await Promise.resolve();
    notifications.push(notification);
  });

  const context = {
    sendNotification,
  } as unknown as ProgressContext;

  // eslint-disable-next-line no-underscore-dangle
  context._meta = { progressToken: 'token-1' };

  return context;
};

const parseEvents = (notifications: readonly ProgressNotification[]): AskStreamEvent[] => {
  const events: AskStreamEvent[] = notifications.map((notification) => {
    return JSON.parse(notification.params.message) as AskStreamEvent;
  });

  return events;
};

describe('handleAsk streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('GIVEN stream_live true and progressToken WHEN stdout chunks arrive THEN emits start chunk done events in order', async () => {
    const context = createAskContext();
    const notifications: ProgressNotification[] = [];
    const extra = createProgressContext(notifications);

    vi.mocked(executeCommand).mockImplementation(async (options) => {
      await Promise.resolve();
      options.onStdoutChunk?.('hello');

      return {
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'hello',
        stdoutBytes: 5,
      };
    });

    await handleAsk(context, { prompt: 'x', stream_live: true }, extra);

    const events = parseEvents(notifications);
    const eventTypes = events.map((event) => event.type);

    expect(eventTypes[0]).toBe('start');
    expect(eventTypes[eventTypes.length - 1]).toBe('done');
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

      return {
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: 'hello',
        stdoutBytes: 5,
      };
    });

    const args: AskToolArgs = { prompt: 'x', stream_live: true };

    await handleAsk(context, args, extra);

    vi.advanceTimersByTime(HEARTBEAT_IDLE_INTERVAL_MS + 10);

    const events = parseEvents(notifications);
    const heartbeatEvents = events.filter((event) => event.type === 'heartbeat');

    expect(heartbeatEvents).toHaveLength(0);
  });
});
