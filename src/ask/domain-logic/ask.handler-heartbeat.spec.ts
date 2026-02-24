import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler.ts';
import type { ProgressContext } from '../../shared/common/index.ts';
import {
  ASK_DEFAULT_ARG_ARRAY_STUB,
  ASK_SUCCESS_EXECUTION_RESULT_STUB,
  ASK_TEST_ENV_STUB,
  createAskContext,
} from '../common/stubs/index.ts';

vi.mock('../args/domain-logic/arg.builder.ts', () => ({
  buildArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
}));

vi.mock('../../shared/domain-logic/command-executor.ts', () => ({
  executeCommand: vi.fn(async () => {
    await Promise.resolve();

    return ASK_SUCCESS_EXECUTION_RESULT_STUB;
  }),
}));

vi.mock('../../shared/utils/platform.util.ts', () => ({
  buildMinimalEnv: vi.fn(() => ASK_TEST_ENV_STUB),
  stripAnsi: vi.fn((input: string) => input),
}));

const { executeCommand } = await import('../../shared/domain-logic/command-executor.ts');

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

describe('handleAsk heartbeat fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN stream_live true WHEN chunk output exists THEN heartbeat event is not emitted', async () => {
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

    const heartbeatCalls = notifications.filter((notification) => {
      const event = JSON.parse(notification.params.message) as Readonly<Record<string, unknown>>;

      return event.type === 'heartbeat';
    });

    expect(heartbeatCalls).toHaveLength(0);
  });
});
