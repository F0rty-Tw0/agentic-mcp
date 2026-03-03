import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { runAskInvocation } from './ask-runner';
import { createBackgroundJob } from '../../background-jobs/data-access';
import { buildJobStatusResponse, startBackgroundInvocation } from '../../background-jobs/domain-logic';
import { SESSION_STORE } from '../../session';
import type { ProgressContext, ResolvedProviderEntry } from '../../shared';
import type { AskToolArgs } from '../common';
import { appendSessionMetadata, buildSessionFlowState, executeSessionFlow } from '../session';

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
  const sessionId = args.session_id;

  if (!sessionId) throw new Error('session_id is required for session-based ask');

  if (!SESSION_STORE.tryAcquireLock(context.name, sessionId)) {
    const callToolResult: CallToolResult = {
      isError: true,
      content: [{ type: 'text', text: `session in use: ${sessionId}` }],
    };

    return callToolResult;
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
      const calLToolResult: CallToolResult = {
        isError: true,
        content: [{ type: 'text', text: 'job_id is required when action=status' }],
      };

      return calLToolResult;
    }

    return buildJobStatusResponse(args.job_id);
  }

  if ((args.mode ?? 'sync') === 'async') {
    const asyncJob = createBackgroundJob(context.name);

    void startBackgroundInvocation(asyncJob.id, async () => runAskInvocationResponse(context, args, extra));
    const text = JSON.stringify({ job_id: asyncJob.id, state: asyncJob.state });

    const callToolResult: CallToolResult = {
      content: [{ type: 'text', text }],
    };

    return callToolResult;
  }

  if (!args.session_id) {
    return runAskInvocationResponse(context, args, extra);
  }

  return handleSessionAsk(context, args, extra);
};
