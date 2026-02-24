import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { runAskInvocation } from './ask-runner.util.ts';
import { SESSION_STORE } from '../../session/session-store.ts';
import type { ResolvedProviderEntry } from '../../shared/common/index.ts';
import { createAskJob } from '../async-jobs/data-access/index.ts';
import { buildAsyncStatusResponse, startAsyncAskInvocation } from '../async-jobs/domain-logic/index.ts';
import type { AskToolArgs, ProgressContext } from '../common/index.ts';
import { appendSessionMetadata, buildSessionFlowState, executeSessionFlow } from '../session/index.ts';

const runAskInvocationResponse = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  extra?: ProgressContext
): Promise<CallToolResult> => {
  const execution = await runAskInvocation({ context, args, extra });

  return execution.response;
};

const handleSessionAsk = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  extra?: ProgressContext
): Promise<CallToolResult> => {
  const sessionId = args.session_id as string;

  if (!SESSION_STORE.tryAcquireLock(context.name, sessionId)) {
    return {
      isError: true,
      content: [{ type: 'text', text: `session in use: ${sessionId}` }],
    };
  }

  try {
    const sessionState = buildSessionFlowState(context, args);
    const result = await executeSessionFlow({ context, args, extra, state: sessionState });

    if (!result.response.isError && !result.wasCancelled) {
      SESSION_STORE.addTurn(context.name, sessionId, { role: 'user', text: args.prompt ?? '' });
      SESSION_STORE.addTurn(context.name, sessionId, { role: 'assistant', text: result.responseText });

      if (result.nativeSessionId) {
        SESSION_STORE.setNativeSessionId(context.name, sessionId, result.nativeSessionId);
      }
    }

    return appendSessionMetadata(result.response, result.sessionMode);
  } finally {
    SESSION_STORE.releaseLock(context.name, sessionId);
  }
};

export const handleAsk = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  extra?: ProgressContext
): Promise<CallToolResult> => {
  if ((args.action ?? 'run') === 'status') {
    if (!args.job_id) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'job_id is required when action=status' }],
      };
    }

    return buildAsyncStatusResponse(args.job_id);
  }

  if ((args.mode ?? 'sync') === 'async') {
    const asyncJob = createAskJob(context.name);

    startAsyncAskInvocation({ context, args, jobId: asyncJob.id, runAskInvocation: runAskInvocationResponse, extra });

    return {
      content: [{ type: 'text', text: JSON.stringify({ job_id: asyncJob.id, state: asyncJob.state }) }],
    };
  }

  if (!args.session_id) {
    return runAskInvocationResponse(context, args, extra);
  }

  return handleSessionAsk(context, args, extra);
};
