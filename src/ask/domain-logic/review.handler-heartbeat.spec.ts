import type { CallToolResult, ServerNotification, TextContent } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleReview } from './review.handler';
import type { ExecutionResult } from '../../shared';
import { executeCommand } from '../../shared';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ReviewToolArgs } from '../common';
import { ASK_DEFAULT_ARG_ARRAY_STUB } from '../test/stubs/ask-arg-array.stub';
import { ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB } from '../test/stubs/ask-execution-result.stub';
import { createAskContext } from '../test/utils/ask-context.spec.util';

vi.mock('../../cli-args/domain-logic/arg.builder', () => {
  const result = { buildReviewArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB) };

  return result;
});

vi.mock('../../shared/command-execution/domain-logic/command-executor', () => {
  const result = { executeCommand: vi.fn() };

  return result;
});

vi.mock('./ask-runner-response.builder', () => {
  const result = {
    buildSuccessfulResponse: vi.fn(async () => {
      const successContent: TextContent[] = [{ type: 'text', text: 'review output' }];
      const successResponse: CallToolResult = { content: successContent };

      return Promise.resolve(successResponse);
    }),
  };

  return result;
});

type SendNotification = NonNullable<ProgressContext['sendNotification']>;

type PendingExecution = { resolve: (result: ExecutionResult) => void };

const HEARTBEAT_PERIOD_MS = 30_000;

const REVIEW_ARGS: ReviewToolArgs = { scope: 'uncommitted' };

const buildProgressContext = (sendNotification: SendNotification): ProgressContext => {
  const meta = { progressToken: 'token-1' };
  const progressContext: ProgressContext = { sendNotification, ['_meta']: meta };

  return progressContext;
};

const toProgressMessages = (notification: ServerNotification): string[] => {
  if (notification.method !== 'notifications/progress') return [];

  const messages = [notification.params.message ?? ''];

  return messages;
};

const readProgressMessages = (sendNotification: SendNotification): string[] => {
  const notifications = vi.mocked(sendNotification).mock.calls.map(([notification]) => notification);
  const messages = notifications.flatMap(toProgressMessages);

  return messages;
};

const holdExecution = (): PendingExecution => {
  const pendingExecution: PendingExecution = { resolve: () => undefined };

  const pendingResult = async (): Promise<ExecutionResult> => {
    const result = await new Promise<ExecutionResult>((resolve) => {
      pendingExecution.resolve = resolve;
    });

    return result;
  };

  vi.mocked(executeCommand).mockImplementation(pendingResult);

  return pendingExecution;
};

describe('FEATURE: review heartbeat', () => {
  let sendNotification: SendNotification;

  beforeEach(() => {
    vi.useFakeTimers();
    sendNotification = vi.fn(async () => Promise.resolve());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('GIVEN a client progress token and live streaming off', () => {
    it('WHEN the review runs for 30 s THEN heartbeat progress notifications keep the call alive', async () => {
      const pendingExecution = holdExecution();
      const reviewPromise = handleReview(createAskContext(), REVIEW_ARGS, buildProgressContext(sendNotification));

      await vi.advanceTimersByTimeAsync(HEARTBEAT_PERIOD_MS);
      pendingExecution.resolve(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB);
      await reviewPromise;

      expect(readProgressMessages(sendNotification)).toStrictEqual([
        'Processing… (0s elapsed)',
        'Processing… (30s elapsed)',
      ]);
    });

    it('WHEN the review has finished THEN no further heartbeat is sent', async () => {
      const pendingExecution = holdExecution();
      const reviewPromise = handleReview(createAskContext(), REVIEW_ARGS, buildProgressContext(sendNotification));

      pendingExecution.resolve(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB);
      await reviewPromise;
      vi.mocked(sendNotification).mockClear();
      await vi.advanceTimersByTimeAsync(HEARTBEAT_PERIOD_MS * 2);

      expect(sendNotification).not.toHaveBeenCalled();
    });
  });
});
