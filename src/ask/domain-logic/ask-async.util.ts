import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProviderEntry } from '../../shared/common/index.ts';
import type { AskToolArgs, ProgressContext } from '../common/index.ts';
import { getAskJob, setAskJobCompleted, setAskJobFailed, setAskJobRunning } from '../data-access/ask-job-store.ts';

type RunAskInvocationFn = (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  extra?: ProgressContext
) => Promise<CallToolResult>;

const extractTextContent = (response: CallToolResult): string => {
  const firstContent = response.content[0];

  if (firstContent?.type !== 'text') return '';

  return firstContent.text;
};

export const buildAsyncStatusResponse = (jobId: string): CallToolResult => {
  const record = getAskJob(jobId);

  if (!record) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown job_id: ${jobId}` }],
    };
  }

  const payload: Readonly<Record<string, string>> = {
    job_id: record.id,
    state: record.state,
    updated_at: record.updatedAt,
    ...(record.resultText ? { result: record.resultText } : {}),
    ...(record.error ? { error: record.error } : {}),
  };

  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
};

type StartAsyncAskInvocationInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  jobId: string;
  runAskInvocation: RunAskInvocationFn;
  extra?: ProgressContext;
}>;

export const startAsyncAskInvocation = ({
  context,
  args,
  jobId,
  runAskInvocation,
  extra,
}: StartAsyncAskInvocationInput): void => {
  void Promise.resolve()
    .then(async () => {
      setAskJobRunning(jobId);

      const response = await runAskInvocation(context, args, extra);

      if (response.isError) {
        setAskJobFailed(jobId, extractTextContent(response) || 'ask invocation failed');

        return;
      }

      setAskJobCompleted(jobId, extractTextContent(response));
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'ask invocation failed';

      setAskJobFailed(jobId, message);
    });
};
