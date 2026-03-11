import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { BackgroundJobCompletionInput, BackgroundJobStatusPayload } from '../common';
import {
  getBackgroundJob,
  setBackgroundJobCompleted,
  setBackgroundJobFailed,
  setBackgroundJobRunning,
} from '../data-access';
import { extractTextContent } from '../utils';

type RunInvocationFn = () => Promise<CallToolResult>;

export const buildJobStatusResponse = (jobId: string): CallToolResult => {
  const record = getBackgroundJob(jobId);

  if (!record) {
    const callToolResult: CallToolResult = {
      isError: true,
      content: [{ type: 'text', text: `Unknown job_id: ${jobId}` }],
    };

    return callToolResult;
  }
  const resultText = record.resultText ? { result: record.resultText } : {};
  const structuredContent = record.structuredContent ? { structuredContent: record.structuredContent } : {};
  const errorText = record.error ? { error: record.error } : {};

  const payload: BackgroundJobStatusPayload = {
    job_id: record.id,
    state: record.state,
    updated_at: record.updatedAt,
    ...resultText,
    ...structuredContent,
    ...errorText,
  };

  const text = JSON.stringify(payload);
  const callToolResult: CallToolResult = {
    content: [{ type: 'text', text }],
  };

  return callToolResult;
};

export const startBackgroundInvocation = async (jobId: string, run: RunInvocationFn): Promise<void> => {
  const DEFAULT_FAILURE_MESSAGE = 'background invocation failed';

  try {
    setBackgroundJobRunning(jobId);

    const response = await run();

    if (response.isError) {
      setBackgroundJobFailed(jobId, extractTextContent(response) || DEFAULT_FAILURE_MESSAGE);

      return;
    }

    const backgroundJobCompletionInput: BackgroundJobCompletionInput = {
      resultText: extractTextContent(response),
      structuredContent: response.structuredContent as Readonly<Record<string, unknown>> | undefined,
    };

    setBackgroundJobCompleted(jobId, backgroundJobCompletionInput);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : DEFAULT_FAILURE_MESSAGE;

    setBackgroundJobFailed(jobId, message);
  }
};
