import type { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';

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
    const content: TextContent[] = [{ type: 'text', text: `Unknown job_id: ${jobId}` }];
    const callToolResult: CallToolResult = {
      isError: true,
      content,
    };

    return callToolResult;
  }
  const emptyPatch = {};
  const resultPatch = { result: record.resultText };
  const structuredContentPatch = { structuredContent: record.structuredContent };
  const errorPatch = { error: record.error };
  const resultText = record.resultText ? resultPatch : emptyPatch;
  const structuredContent = record.structuredContent ? structuredContentPatch : emptyPatch;
  const errorText = record.error ? errorPatch : emptyPatch;

  const payload: BackgroundJobStatusPayload = {
    job_id: record.id,
    state: record.state,
    updated_at: record.updatedAt,
    ...resultText,
    ...structuredContent,
    ...errorText,
  };

  const text = JSON.stringify(payload);
  const statusContent: TextContent[] = [{ type: 'text', text }];
  const callToolResult: CallToolResult = {
    content: statusContent,
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
      structuredContent: response.structuredContent,
    };

    setBackgroundJobCompleted(jobId, backgroundJobCompletionInput);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : DEFAULT_FAILURE_MESSAGE;

    setBackgroundJobFailed(jobId, message);
  }
};
