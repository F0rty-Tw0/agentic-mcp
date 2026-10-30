import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler';
import { resetBackgroundJobStoreForTests } from '../../background-jobs/data-access';
import { TEST_MINIMAL_ENV_STUB, executeCommand } from '../../shared';
import type { ProgressContext, ResolvedProviderEntry } from '../../shared';
import { ValidationError } from '../../shared/validation/common';
import type { AskToolArgs } from '../common';
import { ASK_DEFAULT_ARG_ARRAY_STUB } from '../test/stubs/ask-arg-array.stub';
import { ASK_SUCCESS_EXECUTION_RESULT_STUB } from '../test/stubs/ask-execution-result.stub';
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
    executeCommand: vi.fn(),
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

const createClientProgressContext = (): ProgressContext => {
  const sendNotification = vi.fn(async (): Promise<void> => {
    await Promise.resolve();
  });
  const progressMeta = { progressToken: 'client-token' };
  const progressContext: ProgressContext = {
    sendNotification,
    ['_meta']: progressMeta,
  };

  return progressContext;
};

const readJobId = (startText: string): string => {
  const match = /"job_id":"([^"]+)"/.exec(startText);
  const jobId = match?.[1] ?? '';

  return jobId;
};

const assertJobCompleted = async (context: ResolvedProviderEntry, jobId: string): Promise<void> => {
  const statusArgs: AskToolArgs = { action: 'status', job_id: jobId };
  const status = await handleAsk(context, statusArgs);
  const statusText = readFirstText(status);
  const isCompleted = statusText.includes('"state":"completed"');

  if (!isCompleted) throw new Error(`job ${jobId} not completed: ${statusText}`);
};

const runAsyncJobToCompletion = async (args: AskToolArgs, extra: ProgressContext): Promise<void> => {
  const context = createAskContext();
  const start = await handleAsk(context, args, extra);
  const jobId = readJobId(readFirstText(start));

  await vi.waitFor(async () => assertJobCompleted(context, jobId));
};

describe('handleAsk async mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBackgroundJobStoreForTests();

    vi.mocked(executeCommand).mockImplementation(async (options) => {
      await Promise.resolve();
      options.onStdoutChunk?.('chunk');

      return ASK_SUCCESS_EXECUTION_RESULT_STUB;
    });
  });

  it('GIVEN a client progressToken WHEN the async job runs to completion THEN no heartbeat is sent after the job_id response', async () => {
    const extra = createClientProgressContext();
    const args: AskToolArgs = { prompt: 'x', mode: 'async' };

    await runAsyncJobToCompletion(args, extra);

    expect(extra.sendNotification).not.toHaveBeenCalled();
  });

  it('GIVEN stream_live and a client progressToken WHEN the async job streams output THEN no stream event is sent after the job_id response', async () => {
    const extra = createClientProgressContext();
    const args: AskToolArgs = { prompt: 'x', mode: 'async', stream_live: true };

    await runAsyncJobToCompletion(args, extra);

    expect(extra.sendNotification).not.toHaveBeenCalled();
  });

  it('GIVEN a session_id WHEN asking in async mode THEN it rejects with a ValidationError and runs no command', async () => {
    const context = createAskContext();
    const args: AskToolArgs = { prompt: 'x', mode: 'async', session_id: 'session-1' };

    const asked = handleAsk(context, args);

    await expect(asked).rejects.toThrow(ValidationError);
    expect(executeCommand).not.toHaveBeenCalled();
  });
});
