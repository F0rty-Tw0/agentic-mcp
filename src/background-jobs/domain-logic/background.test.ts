/**
 * Integration test — exercises the async background job lifecycle end-to-end.
 * No mocks, no stubs. Uses real child processes via handleAsk.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { handleAsk } from '../../ask/domain-logic/ask.handler';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared';
import { resetBackgroundJobStoreForTests } from '../data-access';

type JobPayload = Readonly<{
  job_id: string;
  state: string;
  result?: string;
  error?: string;
}>;

const parsePayload = (result: { content: readonly { type: string }[] }): JobPayload => {
  const first = result.content[0] as { type: string; text: string };
  const payload = JSON.parse(first.text) as JobPayload;

  return payload;
};

const createAsyncProviderContext = (script: string): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    enabled: true,
    description: 'Node async test provider',
    command: process.execPath,
    timeout: 10_000,
    env: {},
    outputFormat: 'json',
    commands: {
      ask: {
        args: ['-e', script],
        flags: {},
      },
    },
    input: { method: 'positional' },
  };

  const context: ResolvedProviderEntry = {
    name: 'node-async',
    binaryPath: process.execPath,
    config,
  };

  return context;
};

const pollUntilDone = async (context: ResolvedProviderEntry, jobId: string, maxAttempts = 50): Promise<JobPayload> => {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await handleAsk(context, { prompt: '', action: 'status', job_id: jobId });
    const payload = parsePayload(status);

    if (payload.state === 'completed' || payload.state === 'failed') return payload;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('Job did not complete in time');
};

beforeEach(() => {
  resetBackgroundJobStoreForTests();
});

describe('integration: async job lifecycle', () => {
  it('GIVEN mode=async WHEN handleAsk is called THEN it returns job_id with pending state', async () => {
    const context = createAsyncProviderContext("process.stdout.write('hello'); process.exit(0);");

    const result = await handleAsk(context, { prompt: 'ignored', mode: 'async' });
    const payload = parsePayload(result);

    expect(result.isError).toBeUndefined();
    expect(payload.job_id).toBeTruthy();
    expect(payload.state).toBe('pending');
  });

  it('GIVEN an async job WHEN polling until done THEN state transitions to completed with result text', async () => {
    const context = createAsyncProviderContext("process.stdout.write('async-output'); process.exit(0);");

    const createResult = await handleAsk(context, { prompt: 'ignored', mode: 'async' });
    const createPayload = parsePayload(createResult);

    const finalPayload = await pollUntilDone(context, createPayload.job_id);

    expect(finalPayload.state).toBe('completed');
    expect(finalPayload.result).toContain('async-output');
  });

  it('GIVEN a failing async job WHEN polling until done THEN state transitions to failed with error captured', async () => {
    const context = createAsyncProviderContext("process.stderr.write('boom'); process.exit(1);");

    const createResult = await handleAsk(context, { prompt: 'ignored', mode: 'async' });
    const createPayload = parsePayload(createResult);

    const finalPayload = await pollUntilDone(context, createPayload.job_id);

    expect(finalPayload.state).toBe('failed');
    expect(finalPayload.error).toBeTruthy();
  });

  it('GIVEN a fake job_id WHEN checking status THEN returns isError with Unknown job_id', async () => {
    const context = createAsyncProviderContext("process.exit(0);");

    const result = await handleAsk(context, { prompt: '', action: 'status', job_id: 'nonexistent-id' });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Unknown job_id');
  });
});
