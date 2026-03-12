import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCommandFailure, buildExecutionEnv } from './ask-command';
import { buildSuccessfulResponse } from './ask-runner-response.builder';
import { handleReview } from './review.handler';
import { buildReviewArgArray } from '../../cli-args/domain-logic/arg.builder';
import type { ProgressContext } from '../../shared';
import { executeCommand } from '../../shared';
import * as requestRegistry from '../../shared/validation/domain-logic/request-registry';
import {
  ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB,
  ASK_DEFAULT_ARG_ARRAY_STUB,
  createAskContext,
} from '../common/stubs';

vi.mock('../../cli-args/domain-logic/arg.builder', () => ({
  buildReviewArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
}));

vi.mock('../../shared/command-execution/domain-logic/command-executor', () => ({
  executeCommand: vi.fn(async () => Promise.resolve(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB)),
}));

vi.mock('./ask-command', () => ({
  buildExecutionEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
  buildCommandFailure: vi.fn(async () => {
    const response = await Promise.resolve({
      toMcpResponse: (): CallToolResult => ({ isError: true, content: [{ type: 'text', text: 'review failed' }] }),
    });

    return response;
  }),
}));

vi.mock('./ask-runner-response.builder', () => ({
  buildSuccessfulResponse: vi.fn(async () => Promise.resolve({ content: [{ type: 'text', text: 'review output' }] })),
}));

const createProgressContext = (requestId?: string): ProgressContext => {
  const progressContext: ProgressContext = {
    sendNotification: vi.fn(async () => {
      await Promise.resolve();
    }),
    ...(requestId ? { requestId } : {}),
  };

  Reflect.set(progressContext, '_meta', { progressToken: 'token-1' });

  return progressContext;
};

type NotificationCall = readonly [Readonly<{ params?: Readonly<{ message?: string }> }>];

const readSerializedMessages = (progressContext: ProgressContext): string => {
  const sendNotification = vi.mocked(
    progressContext.sendNotification as NonNullable<ProgressContext['sendNotification']>
  );
  const calls = sendNotification.mock.calls as NotificationCall[];
  const messages = calls.map(([notification]) => notification.params?.message ?? '');

  return messages.join(' ');
};

describe('handleReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildReviewArgArray).mockReturnValue(ASK_DEFAULT_ARG_ARRAY_STUB);
    vi.mocked(executeCommand).mockResolvedValue(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB);
    vi.mocked(buildExecutionEnv).mockReturnValue({ PATH: '/usr/bin' });
    vi.mocked(buildSuccessfulResponse).mockResolvedValue({ content: [{ type: 'text', text: 'review output' }] });
  });

  afterEach(() => {
    requestRegistry.unregisterActiveRequest('req-1');
    vi.restoreAllMocks();
  });

  it('GIVEN review scope WHEN handling review THEN it builds review args and delegates to executeCommand', async () => {
    const context = createAskContext({
      commands: {
        ask: { args: ['exec'], flags: {} },
        review: {
          args: ['review'],
          flags: {
            uncommitted: ['--uncommitted'],
            base: '--base',
            commit: '--commit',
          },
        },
      },
    });

    await handleReview(context, { scope: 'uncommitted' });

    expect(buildReviewArgArray).toHaveBeenCalledWith(context.config, { scope: 'uncommitted' });
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        binaryPath: '/usr/bin/test-cli',
        args: ASK_DEFAULT_ARG_ARRAY_STUB.args,
        env: { PATH: '/usr/bin' },
        timeoutMs: 120_000,
      })
    );
  });

  it('GIVEN working_directory for review WHEN handling review THEN it passes cwd to executeCommand', async () => {
    const context = createAskContext({
      commands: {
        ask: { args: ['exec'], flags: {} },
        review: {
          args: ['review'],
          flags: {
            uncommitted: ['--uncommitted'],
            base: '--base',
            commit: '--commit',
            workingDir: '-C',
          },
        },
      },
    });

    await handleReview(context, { scope: 'uncommitted', working_directory: '/repo' });

    expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/repo' }));
  });

  it('GIVEN review stream_live true WHEN command emits chunks THEN it forwards progress notifications', async () => {
    const context = createAskContext({
      commands: {
        ask: { args: ['exec'], flags: {} },
        review: {
          args: ['review'],
          flags: {
            uncommitted: ['--uncommitted'],
            base: '--base',
            commit: '--commit',
          },
        },
      },
    });
    const extra = createProgressContext();

    vi.mocked(executeCommand).mockImplementation(async (options) => {
      await Promise.resolve();
      options.onStdoutChunk?.('chunk-data');

      return {
        ...ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB,
        stdout: 'chunk-data',
        stdoutBytes: 10,
      };
    });

    await handleReview(context, { scope: 'uncommitted', stream_live: true }, extra);

    expect(extra.sendNotification).toHaveBeenCalled();
  });

  it('GIVEN review requestId WHEN the provider process spawns THEN it registers and unregisters the active request', async () => {
    const context = createAskContext({
      commands: {
        ask: { args: ['exec'], flags: {} },
        review: {
          args: ['review'],
          flags: {
            uncommitted: ['--uncommitted'],
            base: '--base',
            commit: '--commit',
          },
        },
      },
    });
    const registerSpy = vi.spyOn(requestRegistry, 'registerActiveRequest');
    const unregisterSpy = vi.spyOn(requestRegistry, 'unregisterActiveRequest');
    const extra = createProgressContext('req-1');

    vi.mocked(executeCommand).mockImplementation(async (options) => {
      await Promise.resolve();
      options.onSpawned?.(777);

      return ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB;
    });

    await handleReview(context, { scope: 'uncommitted' }, extra);

    expect(registerSpy).toHaveBeenCalledWith('req-1', 777);
    expect(unregisterSpy).toHaveBeenCalledWith('req-1');
    expect(requestRegistry.getActiveRequest('req-1')).toBeUndefined();
  });

  it('GIVEN review streaming and a failed execution WHEN handling review THEN it emits a terminal error event', async () => {
    const context = createAskContext({
      commands: {
        ask: { args: ['exec'], flags: {} },
        review: {
          args: ['review'],
          flags: {
            uncommitted: ['--uncommitted'],
            base: '--base',
            commit: '--commit',
          },
        },
      },
    });
    const extra = createProgressContext();

    vi.mocked(executeCommand).mockResolvedValue({
      ...ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB,
      exitCode: 1,
    });

    await handleReview(context, { scope: 'uncommitted', stream_live: true }, extra);

    const serializedMessages = readSerializedMessages(extra);

    expect(serializedMessages).toContain('"type":"start"');
    expect(serializedMessages).toContain('"type":"error"');
    expect(serializedMessages).toContain('review failed');
  });

  it('GIVEN successful review execution WHEN handling review THEN it returns the successful response builder output', async () => {
    const context = createAskContext({
      commands: {
        ask: { args: ['exec'], flags: {} },
        review: {
          args: ['review'],
          flags: {
            uncommitted: ['--uncommitted'],
            base: '--base',
            commit: '--commit',
          },
        },
      },
    });
    const successResult: CallToolResult = { content: [{ type: 'text', text: 'review output' }] };

    vi.mocked(buildSuccessfulResponse).mockResolvedValue(successResult);

    const result = await handleReview(context, { scope: 'uncommitted', include_structured: true, model: 'gpt-5' });

    expect(buildSuccessfulResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        args: { include_structured: true, model: 'gpt-5' },
        stdout: 'command output',
      })
    );
    expect(result).toBe(successResult);
  });

  it('GIVEN failed review execution WHEN handling review THEN it returns the mapped command failure response', async () => {
    const context = createAskContext({
      commands: {
        ask: { args: ['exec'], flags: {} },
        review: {
          args: ['review'],
          flags: {
            uncommitted: ['--uncommitted'],
            base: '--base',
            commit: '--commit',
          },
        },
      },
    });

    vi.mocked(executeCommand).mockResolvedValue({
      ...ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB,
      exitCode: 1,
    });

    const result = await handleReview(context, { scope: 'uncommitted' });

    expect(buildCommandFailure).toHaveBeenCalled();
    expect(result).toStrictEqual({ isError: true, content: [{ type: 'text', text: 'review failed' }] });
  });
});
