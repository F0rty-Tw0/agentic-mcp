import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler.ts';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared/common/index.ts';
import {
  ASK_DEFAULT_ARG_ARRAY_STUB,
  ASK_PROVIDER_CONFIG_STUB,
  ASK_RESOLVED_PROVIDER_ENTRY_STUB,
  ASK_SUCCESS_EXECUTION_RESULT_STUB,
  ASK_TEST_ENV_STUB,
} from '../common/stubs/index.ts';
import { resetAskJobStoreForTests } from '../data-access/ask-job-store.ts';

vi.mock('./arg.builder.ts', () => ({
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

const createContext = (overrides: Partial<ProviderConfig> = {}): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    ...ASK_PROVIDER_CONFIG_STUB,
    ...overrides,
  };

  const context: ResolvedProviderEntry = {
    ...ASK_RESOLVED_PROVIDER_ENTRY_STUB,
    config,
  };

  return context;
};

const readTextContent = (result: Awaited<ReturnType<typeof handleAsk>>): string => {
  const content = result.content[0];

  if (content?.type !== 'text') return '';

  return content.text;
};

describe('handleAsk async jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAskJobStoreForTests();
  });

  it('GIVEN mode async WHEN handling ask THEN returns job_id with pending state', async () => {
    const context = createContext();

    const result = await handleAsk(context, { prompt: 'x', mode: 'async' });
    const payload = JSON.parse(readTextContent(result)) as Readonly<Record<string, string>>;

    expect(payload.job_id).toBeDefined();
    expect(payload.state).toBe('pending');
  });

  it('GIVEN completed async job WHEN polling status THEN returns completed with final output', async () => {
    const context = createContext();

    vi.mocked(executeCommand).mockResolvedValue({
      ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
      stdout: 'completed output',
      stdoutBytes: 16,
    });

    const startResult = await handleAsk(context, { prompt: 'x', mode: 'async' });
    const startPayload = JSON.parse(readTextContent(startResult)) as Readonly<Record<string, string>>;
    const jobId = startPayload.job_id;

    expect(jobId).toBeDefined();

    if (!jobId) throw new Error('job_id should be present');

    await new Promise((resolve) => setTimeout(resolve, 10));

    const statusResult = await handleAsk(context, { action: 'status', job_id: jobId });
    const statusPayload = JSON.parse(readTextContent(statusResult)) as Readonly<Record<string, string>>;

    expect(statusPayload.state).toBe('completed');
    expect(statusPayload.result).toBe('completed output');
  });
});
