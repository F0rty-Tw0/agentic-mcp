import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCommandFailure, buildExecutionEnv } from './ask-command';
import { buildSuccessfulResponse } from './ask-runner-response.builder';
import { handleReview } from './review.handler';
import { buildReviewArgArray } from '../../cli-args/domain-logic/arg.builder';
import type { ProgressContext } from '../../shared';
import { executeCommand } from '../../shared';
import * as requestRegistry from '../../shared/validation/domain-logic/request-registry';
import { ASK_DEFAULT_ARG_ARRAY_STUB } from '../test/stubs/ask-arg-array.stub';
import { ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB } from '../test/stubs/ask-execution-result.stub';
import { createAskContext } from '../test/utils/ask-context.spec.util';

vi.mock('../../cli-args/domain-logic/arg.builder', () => {
  const result = {
    buildReviewArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
  };

  return result;
});

vi.mock('../../shared/command-execution/domain-logic/command-executor', () => {
  const result = {
    executeCommand: vi.fn(async () => Promise.resolve(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB)),
  };

  return result;
});

vi.mock('./ask-command', () => {
  const result = {
    buildExecutionEnv: vi.fn(() => {
      const env = { PATH: '/usr/bin' };

      return env;
    }),
    buildCommandFailure: vi.fn(async () => {
      const failureContent: TextContent[] = [{ type: 'text', text: 'review failed' }];
      const toMcpResponse = (): CallToolResult => {
        const failureResponse: CallToolResult = { isError: true, content: failureContent };

        return failureResponse;
      };
      const response = await Promise.resolve({ toMcpResponse });

      return response;
    }),
  };

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

const createProgressContext = (requestId?: string): ProgressContext => {
  const noRequestId = {};
  const requestIdPatch = { requestId };
  const requestIdContext = requestId ? requestIdPatch : noRequestId;
  const progressContext: ProgressContext = {
    sendNotification: vi.fn(async () => {
      await Promise.resolve();
    }),
    ...requestIdContext,
  };

  Reflect.set(progressContext, '_meta', { progressToken: 'token-1' });

  return progressContext;
};

type NotificationMessageParams = {
  readonly message?: string;
};

type NotificationWithMessage = {
  readonly params?: NotificationMessageParams;
};

type NotificationCall = readonly [NotificationWithMessage];

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
    const content: TextContent[] = [{ type: 'text', text: 'review output' }];

    vi.mocked(buildSuccessfulResponse).mockResolvedValue({ content });
  });

  afterEach(() => {
    requestRegistry.unregisterActiveRequest('req-1');
    vi.restoreAllMocks();
  });

  it('GIVEN review scope WHEN handling review THEN it builds review args and delegates to executeCommand', async () => {
    const ask = { args: ['exec'], flags: {} };
    const flags = {
      uncommitted: ['--uncommitted'],
      base: '--base',
      commit: '--commit',
    };
    const review = {
      args: ['review'],
      flags,
    };
    const commands = {
      ask,
      review,
    };
    const context = createAskContext({
      commands,
    });

    await handleReview(context, { scope: 'uncommitted' });

    expect(buildReviewArgArray).toHaveBeenCalledWith(context.config, { scope: 'uncommitted' });
    const env = { PATH: '/usr/bin' };

    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        binaryPath: '/usr/bin/test-cli',
        args: ASK_DEFAULT_ARG_ARRAY_STUB.args,
        env,
        timeoutMs: 120_000,
      })
    );
  });

  it('GIVEN working_directory for review WHEN handling review THEN it passes cwd to executeCommand', async () => {
    const ask = { args: ['exec'], flags: {} };
    const flags = {
      uncommitted: ['--uncommitted'],
      base: '--base',
      commit: '--commit',
      workingDir: '-C',
    };
    const review = {
      args: ['review'],
      flags,
    };
    const commands = {
      ask,
      review,
    };
    const context = createAskContext({
      commands,
    });

    await handleReview(context, { scope: 'uncommitted', working_directory: '/repo' });

    expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/repo' }));
  });

  it('GIVEN review stream_live true WHEN command emits chunks THEN it forwards progress notifications', async () => {
    const ask = { args: ['exec'], flags: {} };
    const flags = {
      uncommitted: ['--uncommitted'],
      base: '--base',
      commit: '--commit',
    };
    const review = {
      args: ['review'],
      flags,
    };
    const commands = {
      ask,
      review,
    };
    const context = createAskContext({
      commands,
    });
    const extra = createProgressContext();

    vi.mocked(executeCommand).mockImplementation(async (options) => {
      await Promise.resolve();
      options.onStdoutChunk?.('chunk-data');

      const result = {
        ...ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB,
        stdout: 'chunk-data',
        stdoutBytes: 10,
      };

      return result;
    });

    await handleReview(context, { scope: 'uncommitted', stream_live: true }, extra);

    expect(extra.sendNotification).toHaveBeenCalled();
  });

  it('GIVEN review requestId WHEN the provider process spawns THEN it registers and unregisters the active request', async () => {
    const ask = { args: ['exec'], flags: {} };
    const flags = {
      uncommitted: ['--uncommitted'],
      base: '--base',
      commit: '--commit',
    };
    const review = {
      args: ['review'],
      flags,
    };
    const commands = {
      ask,
      review,
    };
    const context = createAskContext({
      commands,
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
    const ask = { args: ['exec'], flags: {} };
    const flags = {
      uncommitted: ['--uncommitted'],
      base: '--base',
      commit: '--commit',
    };
    const review = {
      args: ['review'],
      flags,
    };
    const commands = {
      ask,
      review,
    };
    const context = createAskContext({
      commands,
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
    const ask = { args: ['exec'], flags: {} };
    const flags = {
      uncommitted: ['--uncommitted'],
      base: '--base',
      commit: '--commit',
    };
    const review = {
      args: ['review'],
      flags,
    };
    const commands = {
      ask,
      review,
    };
    const context = createAskContext({
      commands,
    });
    const content: TextContent[] = [{ type: 'text', text: 'review output' }];
    const successResult: CallToolResult = { content };

    vi.mocked(buildSuccessfulResponse).mockResolvedValue(successResult);

    const result = await handleReview(context, { scope: 'uncommitted', include_structured: true, model: 'gpt-5' });

    const args = { include_structured: true, model: 'gpt-5' };

    expect(buildSuccessfulResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        args,
        stdout: 'command output',
      })
    );
    expect(result).toBe(successResult);
  });

  it('GIVEN failed review execution WHEN handling review THEN it returns the mapped command failure response', async () => {
    const ask = { args: ['exec'], flags: {} };
    const flags = {
      uncommitted: ['--uncommitted'],
      base: '--base',
      commit: '--commit',
    };
    const review = {
      args: ['review'],
      flags,
    };
    const commands = {
      ask,
      review,
    };
    const context = createAskContext({
      commands,
    });

    vi.mocked(executeCommand).mockResolvedValue({
      ...ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB,
      exitCode: 1,
    });

    const result = await handleReview(context, { scope: 'uncommitted' });

    expect(buildCommandFailure).toHaveBeenCalled();
    const content: TextContent[] = [{ type: 'text', text: 'review failed' }];

    expect(result).toStrictEqual({ isError: true, content });
  });
});
