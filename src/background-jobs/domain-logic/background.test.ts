/**
 * Integration test — exercises the async background job lifecycle end-to-end.
 * No mocks, no stubs. Uses real child processes via handleAsk.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it } from 'vitest';

import { handleAsk } from '../../ask/domain-logic/ask.handler';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared/provider/common';
import { resetBackgroundJobStoreForTests } from '../data-access';
import { extractTextContent } from '../utils';

type JobPayload = {
  readonly job_id: string;
  readonly state: string;
  readonly result?: string;
  readonly error?: string;
};

const parsePayload = (result: CallToolResult): JobPayload => {
  const text = extractTextContent(result);
  const payload = JSON.parse(text) as JobPayload;

  return payload;
};

const createAsyncProviderContext = (script: string): ResolvedProviderEntry => {
  const ask = {
    args: ['-e', script],
    flags: {},
  };
  const commands = {
    ask,
  };
  const input = { method: 'positional' } as const;
  const config: ProviderConfig = {
    enabled: true,
    description: 'Node async test provider',
    command: process.execPath,
    timeout: 10_000,
    env: {},
    outputFormat: 'json',
    commands,
    input,
  };

  const context: ResolvedProviderEntry = {
    name: 'node-async',
    binaryPath: process.execPath,
    config,
  };

  return context;
};

const TERMINAL_STATES = new Set(['completed', 'failed']);

const pollOnce = async (context: ResolvedProviderEntry, jobId: string): Promise<JobPayload | undefined> => {
  const status = await handleAsk(context, { prompt: '', action: 'status', job_id: jobId });
  const payload = parsePayload(status);

  return TERMINAL_STATES.has(payload.state) ? payload : undefined;
};

const delay = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const pollLoop = async (
  context: ResolvedProviderEntry,
  jobId: string,
  maxAttempts: number
): Promise<JobPayload | undefined> => {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await pollOnce(context, jobId);

    if (result) return result;

    await delay(50);
  }

  return undefined;
};

const pollUntilDone = async (context: ResolvedProviderEntry, jobId: string): Promise<JobPayload> => {
  const result = await pollLoop(context, jobId, 50);

  if (!result) throw new Error('Job did not complete in time');

  return result;
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
    const context = createAsyncProviderContext('process.exit(0);');

    const result = await handleAsk(context, { prompt: '', action: 'status', job_id: 'nonexistent-id' });

    expect(result.isError).toBe(true);

    const text = extractTextContent(result);

    expect(text).toContain('Unknown job_id');
  });
});
