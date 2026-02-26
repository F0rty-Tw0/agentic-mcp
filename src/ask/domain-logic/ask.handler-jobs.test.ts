import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler';
import { resetBackgroundJobStoreForTests } from '../../background-jobs/data-access';
import { TEST_MINIMAL_ENV_STUB } from '../../shared/common/stubs';
import { ASK_DEFAULT_ARG_ARRAY_STUB, ASK_SUCCESS_EXECUTION_RESULT_STUB, createAskContext } from '../common/stubs';

vi.mock('../cli-args/domain-logic/arg.builder', () => ({
  buildArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
}));

vi.mock('../../shared/domain-logic/command-executor', () => ({
  executeCommand: vi.fn(async () => {
    await Promise.resolve();

    return ASK_SUCCESS_EXECUTION_RESULT_STUB;
  }),
}));

vi.mock('../../shared/utils/platform.util', () => ({
  buildMinimalEnv: vi.fn(() => TEST_MINIMAL_ENV_STUB),
  stripAnsi: vi.fn((input: string) => input),
}));

const { executeCommand } = await import('../../shared/domain-logic/command-executor');

type AsyncJobPayload = Readonly<Record<string, string>>;

const readTextContent = (result: Awaited<ReturnType<typeof handleAsk>>): string => {
  const content = result.content[0];

  if (content?.type !== 'text') return '';

  return content.text;
};

describe('handleAsk async jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBackgroundJobStoreForTests();
  });

  it('GIVEN mode async WHEN handling ask THEN returns job_id with pending state', async () => {
    const context = createAskContext();

    const result = await handleAsk(context, { prompt: 'x', mode: 'async' });
    const payload = JSON.parse(readTextContent(result)) as AsyncJobPayload;

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
    const startPayload = JSON.parse(readTextContent(startResult)) as AsyncJobPayload;
    const jobId = startPayload.job_id;

    expect(jobId).toBeDefined();

    if (!jobId) throw new Error('job_id should be present');

    await new Promise((resolve) => setTimeout(resolve, 10));

    const statusResult = await handleAsk(context, { action: 'status', job_id: jobId });
    const statusPayload = JSON.parse(readTextContent(statusResult)) as AsyncJobPayload;

    expect(statusPayload.state).toBe('completed');
    expect(statusPayload.result).toBe('completed output');
  });
});
