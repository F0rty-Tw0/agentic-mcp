import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAsyncStatusResponse, startAsyncAskInvocation } from './async.util.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/index.ts';
import type { AskToolArgs } from '../../common/index.ts';
import type { AskJobRecord } from '../common/index.ts';

const mocks = vi.hoisted(() => ({
  getAskJob: vi.fn(),
  setAskJobCompleted: vi.fn(),
  setAskJobFailed: vi.fn(),
  setAskJobRunning: vi.fn(),
}));

vi.mock('../data-access/job-store.ts', () => ({
  getAskJob: mocks.getAskJob,
  setAskJobCompleted: mocks.setAskJobCompleted,
  setAskJobFailed: mocks.setAskJobFailed,
  setAskJobRunning: mocks.setAskJobRunning,
}));

const buildCallToolResult = (overrides: Partial<CallToolResult> = {}): CallToolResult => ({
  content: [{ type: 'text', text: 'default response' }],
  ...overrides,
});

const buildResolvedProviderEntry = (overrides: Partial<ResolvedProviderEntry> = {}): ResolvedProviderEntry => ({
  name: 'test-provider',
  binaryPath: '/usr/bin/test-provider',
  config: {
    enabled: true,
    description: 'test provider',
    command: 'test-provider',
    timeout: 30_000,
    env: {},
    outputFormat: 'text',
    commands: { ask: { args: [] } },
    input: { method: 'positional' },
  },
  ...overrides,
});

const buildAskJobRecord = (overrides: Partial<AskJobRecord> = {}): AskJobRecord => ({
  id: 'job-123',
  provider: 'test-provider',
  state: 'pending',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const extractPayloadFromTextContent = (result: CallToolResult): Record<string, string> => {
  const content = result.content[0];

  if (content?.type !== 'text') throw new Error('expected text content');

  const payload = JSON.parse(content.text) as Record<string, string>;

  return payload;
};

describe('buildAsyncStatusResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN unknown jobId WHEN buildAsyncStatusResponse called THEN returns isError with "Unknown job_id" message', () => {
    mocks.getAskJob.mockReturnValue(null);

    const result = buildAsyncStatusResponse('unknown-job-id');

    expect(result.isError).toBe(true);
    expect(result.content[0]).toStrictEqual({ type: 'text', text: 'Unknown job_id: unknown-job-id' });
  });

  it('GIVEN existing completed job WHEN buildAsyncStatusResponse called THEN returns JSON with state, result', () => {
    const record = buildAskJobRecord({
      id: 'job-abc',
      state: 'completed',
      updatedAt: '2024-01-02T00:00:00.000Z',
      resultText: 'the final answer',
    });

    mocks.getAskJob.mockReturnValue(record);

    const result = buildAsyncStatusResponse('job-abc');

    expect(result.isError).toBeUndefined();
    const payload = extractPayloadFromTextContent(result);

    expect(payload.job_id).toBe('job-abc');
    expect(payload.state).toBe('completed');
    expect(payload.result).toBe('the final answer');
    expect(payload.updated_at).toBe('2024-01-02T00:00:00.000Z');
  });

  it('GIVEN existing failed job WHEN buildAsyncStatusResponse called THEN returns JSON with state, error', () => {
    const record = buildAskJobRecord({
      id: 'job-def',
      state: 'failed',
      updatedAt: '2024-01-03T00:00:00.000Z',
      error: 'something went wrong',
    });

    mocks.getAskJob.mockReturnValue(record);

    const result = buildAsyncStatusResponse('job-def');

    expect(result.isError).toBeUndefined();
    const payload = extractPayloadFromTextContent(result);

    expect(payload.job_id).toBe('job-def');
    expect(payload.state).toBe('failed');
    expect(payload.error).toBe('something went wrong');
    expect(payload.result).toBeUndefined();
  });

  it('GIVEN existing pending job WHEN buildAsyncStatusResponse called THEN returns JSON without result or error', () => {
    const record = buildAskJobRecord({
      id: 'job-ghi',
      state: 'pending',
      updatedAt: '2024-01-04T00:00:00.000Z',
    });

    mocks.getAskJob.mockReturnValue(record);

    const result = buildAsyncStatusResponse('job-ghi');

    expect(result.isError).toBeUndefined();
    const payload = extractPayloadFromTextContent(result);

    expect(payload.job_id).toBe('job-ghi');
    expect(payload.state).toBe('pending');
    expect(payload.result).toBeUndefined();
    expect(payload.error).toBeUndefined();
  });
});

describe('startAsyncAskInvocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN successful invocation WHEN startAsyncAskInvocation called THEN sets job running then completed', async () => {
    const context = buildResolvedProviderEntry();
    const args: AskToolArgs = { prompt: 'hello' };
    const successResult = buildCallToolResult({ content: [{ type: 'text', text: 'success output' }] });
    const runAskInvocation = vi.fn().mockResolvedValue(successResult);

    startAsyncAskInvocation({ context, args, jobId: 'job-1', runAskInvocation });

    await vi.waitFor(() => expect(mocks.setAskJobCompleted).toHaveBeenCalled());

    expect(mocks.setAskJobRunning).toHaveBeenCalledWith('job-1');
    expect(mocks.setAskJobCompleted).toHaveBeenCalledWith('job-1', 'success output');
    expect(mocks.setAskJobFailed).not.toHaveBeenCalled();
  });

  it('GIVEN error response from invocation WHEN startAsyncAskInvocation called THEN sets job running then failed with extracted text', async () => {
    const context = buildResolvedProviderEntry();
    const args: AskToolArgs = { prompt: 'hello' };
    const errorResult = buildCallToolResult({
      isError: true,
      content: [{ type: 'text', text: 'invocation error message' }],
    });
    const runAskInvocation = vi.fn().mockResolvedValue(errorResult);

    startAsyncAskInvocation({ context, args, jobId: 'job-2', runAskInvocation });

    await vi.waitFor(() => expect(mocks.setAskJobFailed).toHaveBeenCalled());

    expect(mocks.setAskJobRunning).toHaveBeenCalledWith('job-2');
    expect(mocks.setAskJobFailed).toHaveBeenCalledWith('job-2', 'invocation error message');
    expect(mocks.setAskJobCompleted).not.toHaveBeenCalled();
  });

  it('GIVEN error response with no text WHEN startAsyncAskInvocation called THEN uses default "ask invocation failed" message', async () => {
    const context = buildResolvedProviderEntry();
    const args: AskToolArgs = { prompt: 'hello' };
    const errorResult = buildCallToolResult({
      isError: true,
      content: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }],
    });
    const runAskInvocation = vi.fn().mockResolvedValue(errorResult);

    startAsyncAskInvocation({ context, args, jobId: 'job-3', runAskInvocation });

    await vi.waitFor(() => expect(mocks.setAskJobFailed).toHaveBeenCalled());

    expect(mocks.setAskJobRunning).toHaveBeenCalledWith('job-3');
    expect(mocks.setAskJobFailed).toHaveBeenCalledWith('job-3', 'ask invocation failed');
    expect(mocks.setAskJobCompleted).not.toHaveBeenCalled();
  });

  it('GIVEN invocation throws Error WHEN startAsyncAskInvocation called THEN sets job failed with error message', async () => {
    const context = buildResolvedProviderEntry();
    const args: AskToolArgs = { prompt: 'hello' };
    const runAskInvocation = vi.fn().mockRejectedValue(new Error('network timeout'));

    startAsyncAskInvocation({ context, args, jobId: 'job-4', runAskInvocation });

    await vi.waitFor(() => expect(mocks.setAskJobFailed).toHaveBeenCalled());

    expect(mocks.setAskJobRunning).toHaveBeenCalledWith('job-4');
    expect(mocks.setAskJobFailed).toHaveBeenCalledWith('job-4', 'network timeout');
    expect(mocks.setAskJobCompleted).not.toHaveBeenCalled();
  });

  it('GIVEN invocation throws non-Error WHEN startAsyncAskInvocation called THEN sets job failed with default message', async () => {
    const context = buildResolvedProviderEntry();
    const args: AskToolArgs = { prompt: 'hello' };
    const runAskInvocation = vi.fn().mockRejectedValue('a plain string error');

    startAsyncAskInvocation({ context, args, jobId: 'job-5', runAskInvocation });

    await vi.waitFor(() => expect(mocks.setAskJobFailed).toHaveBeenCalled());

    expect(mocks.setAskJobRunning).toHaveBeenCalledWith('job-5');
    expect(mocks.setAskJobFailed).toHaveBeenCalledWith('job-5', 'ask invocation failed');
    expect(mocks.setAskJobCompleted).not.toHaveBeenCalled();
  });
});
