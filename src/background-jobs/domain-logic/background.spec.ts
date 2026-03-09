import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildJobStatusResponse, startBackgroundInvocation } from './background';
import type { BackgroundJobRecord } from '../common';

type StatusPayload = Readonly<Record<string, unknown>>;

const mocks = vi.hoisted(() => ({
  getBackgroundJob: vi.fn(),
  setBackgroundJobCompleted: vi.fn(),
  setBackgroundJobFailed: vi.fn(),
  setBackgroundJobRunning: vi.fn(),
}));

vi.mock('../data-access/job-store', () => ({
  getBackgroundJob: mocks.getBackgroundJob,
  setBackgroundJobCompleted: mocks.setBackgroundJobCompleted,
  setBackgroundJobFailed: mocks.setBackgroundJobFailed,
  setBackgroundJobRunning: mocks.setBackgroundJobRunning,
}));

const buildCallToolResult = (overrides: Partial<CallToolResult> = {}): CallToolResult => ({
  content: [{ type: 'text', text: 'default response' }],
  ...overrides,
});

const buildBackgroundJobRecord = (overrides: Partial<BackgroundJobRecord> = {}): BackgroundJobRecord => ({
  id: 'job-123',
  provider: 'test-provider',
  state: 'pending',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const extractPayloadFromTextContent = (result: CallToolResult): StatusPayload => {
  const content = result.content[0];

  if (content?.type !== 'text') throw new Error('expected text content');

  const payload = JSON.parse(content.text) as StatusPayload;

  return payload;
};

describe('buildJobStatusResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN unknown jobId WHEN buildJobStatusResponse called THEN returns isError with "Unknown job_id" message', () => {
    mocks.getBackgroundJob.mockReturnValue(null);

    const result = buildJobStatusResponse('unknown-job-id');

    expect(result.isError).toBe(true);
    expect(result.content[0]).toStrictEqual({ type: 'text', text: 'Unknown job_id: unknown-job-id' });
  });

  it('GIVEN existing completed job WHEN buildJobStatusResponse called THEN returns JSON with state, result', () => {
    const record = buildBackgroundJobRecord({
      id: 'job-abc',
      state: 'completed',
      updatedAt: '2024-01-02T00:00:00.000Z',
      resultText: 'the final answer',
    });

    mocks.getBackgroundJob.mockReturnValue(record);

    const result = buildJobStatusResponse('job-abc');

    expect(result.isError).toBeUndefined();
    const payload = extractPayloadFromTextContent(result);

    expect(payload.job_id).toBe('job-abc');
    expect(payload.state).toBe('completed');
    expect(payload.result).toBe('the final answer');
    expect(payload.updated_at).toBe('2024-01-02T00:00:00.000Z');
    expect(payload.structuredContent).toBeUndefined();
  });

  it('GIVEN existing completed job with structuredContent WHEN buildJobStatusResponse called THEN returns JSON with structuredContent', () => {
    const record = buildBackgroundJobRecord({
      id: 'job-structured',
      state: 'completed',
      updatedAt: '2024-01-02T00:00:00.000Z',
      resultText: 'the final answer',
      structuredContent: { response: 'the final answer', attribution: { provider: 'test' } },
    });

    mocks.getBackgroundJob.mockReturnValue(record);

    const result = buildJobStatusResponse('job-structured');
    const payload = extractPayloadFromTextContent(result);

    expect(payload.structuredContent).toStrictEqual({
      response: 'the final answer',
      attribution: { provider: 'test' },
    });
  });

  it('GIVEN existing failed job WHEN buildJobStatusResponse called THEN returns JSON with state, error', () => {
    const record = buildBackgroundJobRecord({
      id: 'job-def',
      state: 'failed',
      updatedAt: '2024-01-03T00:00:00.000Z',
      error: 'something went wrong',
    });

    mocks.getBackgroundJob.mockReturnValue(record);

    const result = buildJobStatusResponse('job-def');

    expect(result.isError).toBeUndefined();
    const payload = extractPayloadFromTextContent(result);

    expect(payload.job_id).toBe('job-def');
    expect(payload.state).toBe('failed');
    expect(payload.error).toBe('something went wrong');
    expect(payload.result).toBeUndefined();
  });

  it('GIVEN existing pending job WHEN buildJobStatusResponse called THEN returns JSON without result or error', () => {
    const record = buildBackgroundJobRecord({
      id: 'job-ghi',
      state: 'pending',
      updatedAt: '2024-01-04T00:00:00.000Z',
    });

    mocks.getBackgroundJob.mockReturnValue(record);

    const result = buildJobStatusResponse('job-ghi');

    expect(result.isError).toBeUndefined();
    const payload = extractPayloadFromTextContent(result);

    expect(payload.job_id).toBe('job-ghi');
    expect(payload.state).toBe('pending');
    expect(payload.result).toBeUndefined();
    expect(payload.error).toBeUndefined();
  });
});

describe('startBackgroundInvocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN successful invocation WHEN startBackgroundInvocation called THEN sets job running then completed', async () => {
    const successResult = buildCallToolResult({ content: [{ type: 'text', text: 'success output' }] });
    const run = vi.fn().mockResolvedValue(successResult);

    void startBackgroundInvocation('job-1', run);

    await vi.waitFor(() => expect(mocks.setBackgroundJobCompleted).toHaveBeenCalled());

    expect(mocks.setBackgroundJobRunning).toHaveBeenCalledWith('job-1');
    expect(mocks.setBackgroundJobCompleted).toHaveBeenCalledWith('job-1', { resultText: 'success output' });
    expect(mocks.setBackgroundJobFailed).not.toHaveBeenCalled();
  });

  it('GIVEN successful invocation with structuredContent WHEN startBackgroundInvocation called THEN persists structuredContent', async () => {
    const successResult = buildCallToolResult({
      content: [{ type: 'text', text: 'success output' }],
      structuredContent: { response: 'success output', attribution: { provider: 'test' } },
    });
    const run = vi.fn().mockResolvedValue(successResult);

    void startBackgroundInvocation('job-structured', run);

    await vi.waitFor(() => expect(mocks.setBackgroundJobCompleted).toHaveBeenCalled());

    expect(mocks.setBackgroundJobCompleted).toHaveBeenCalledWith('job-structured', {
      resultText: 'success output',
      structuredContent: { response: 'success output', attribution: { provider: 'test' } },
    });
  });

  it('GIVEN error response from invocation WHEN startBackgroundInvocation called THEN sets job running then failed with extracted text', async () => {
    const errorResult = buildCallToolResult({
      isError: true,
      content: [{ type: 'text', text: 'invocation error message' }],
    });
    const run = vi.fn().mockResolvedValue(errorResult);

    void startBackgroundInvocation('job-2', run);

    await vi.waitFor(() => expect(mocks.setBackgroundJobFailed).toHaveBeenCalled());

    expect(mocks.setBackgroundJobRunning).toHaveBeenCalledWith('job-2');
    expect(mocks.setBackgroundJobFailed).toHaveBeenCalledWith('job-2', 'invocation error message');
    expect(mocks.setBackgroundJobCompleted).not.toHaveBeenCalled();
  });

  it('GIVEN error response with no text WHEN startBackgroundInvocation called THEN uses default "background invocation failed" message', async () => {
    const errorResult = buildCallToolResult({
      isError: true,
      content: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }],
    });
    const run = vi.fn().mockResolvedValue(errorResult);

    void startBackgroundInvocation('job-3', run);

    await vi.waitFor(() => expect(mocks.setBackgroundJobFailed).toHaveBeenCalled());

    expect(mocks.setBackgroundJobRunning).toHaveBeenCalledWith('job-3');
    expect(mocks.setBackgroundJobFailed).toHaveBeenCalledWith('job-3', 'background invocation failed');
    expect(mocks.setBackgroundJobCompleted).not.toHaveBeenCalled();
  });

  it('GIVEN invocation throws Error WHEN startBackgroundInvocation called THEN sets job failed with error message', async () => {
    const run = vi.fn().mockRejectedValue(new Error('network timeout'));

    void startBackgroundInvocation('job-4', run);

    await vi.waitFor(() => expect(mocks.setBackgroundJobFailed).toHaveBeenCalled());

    expect(mocks.setBackgroundJobRunning).toHaveBeenCalledWith('job-4');
    expect(mocks.setBackgroundJobFailed).toHaveBeenCalledWith('job-4', 'network timeout');
    expect(mocks.setBackgroundJobCompleted).not.toHaveBeenCalled();
  });

  it('GIVEN invocation throws non-Error WHEN startBackgroundInvocation called THEN sets job failed with default message', async () => {
    const run = vi.fn().mockRejectedValue('a plain string error');

    void startBackgroundInvocation('job-5', run);

    await vi.waitFor(() => expect(mocks.setBackgroundJobFailed).toHaveBeenCalled());

    expect(mocks.setBackgroundJobRunning).toHaveBeenCalledWith('job-5');
    expect(mocks.setBackgroundJobFailed).toHaveBeenCalledWith('job-5', 'background invocation failed');
    expect(mocks.setBackgroundJobCompleted).not.toHaveBeenCalled();
  });
});
