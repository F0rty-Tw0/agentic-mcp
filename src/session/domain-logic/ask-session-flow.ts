import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { AskToolArgs } from '../../ask/common';
import { runAskInvocation } from '../../ask/domain-logic/ask-runner';
import type { ProgressContext, ResolvedProviderEntry } from '../../shared';
import type { SessionMode } from '../common';
import { SESSION_STORE } from '../data-access';
import { buildSessionPrompt } from '../utils/session-context.util';

type SessionFlowState = Readonly<{
  sessionId: string;
  prompt: string;
  nativeSessionId?: string;
  mode: SessionMode;
}>;

type SessionFlowResult = Readonly<{
  response: CallToolResult;
  responseText: string;
  nativeSessionId?: string;
  sessionMode: SessionMode;
  wasCancelled: boolean;
}>;

type SessionExecutionInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  extra?: ProgressContext;
  state: SessionFlowState;
}>;

const runSessionExecution = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  extra: ProgressContext | undefined,
  state: SessionFlowState
): Promise<SessionFlowResult> => {
  const execution = await runAskInvocation({
    context,
    args: { ...args, prompt: state.prompt },
    extra,
    tier2SessionId: state.nativeSessionId,
  });
  const result: SessionFlowResult = { ...execution, sessionMode: state.mode };

  return result;
};

export const executeSessionFlow = async ({
  context,
  args,
  extra,
  state,
}: SessionExecutionInput): Promise<SessionFlowResult> => {
  const firstExecution = await runSessionExecution(context, args, extra, state);

  if (!firstExecution.response.isError || state.mode !== 'tier2-native') {
    return firstExecution;
  }

  const fallbackState: SessionFlowState = {
    ...state,
    mode: 'tier2-fallback-to-tier1',
    nativeSessionId: undefined,
  };
  const fallbackExecution = await runSessionExecution(context, args, extra, fallbackState);
  const result: SessionFlowResult = {
    response: fallbackExecution.response,
    responseText: fallbackExecution.responseText,
    nativeSessionId: fallbackExecution.nativeSessionId,
    sessionMode: 'tier2-fallback-to-tier1',
    wasCancelled: fallbackExecution.wasCancelled,
  };

  return result;
};

export const buildSessionFlowState = (context: ResolvedProviderEntry, args: AskToolArgs): SessionFlowState => {
  const sessionId = args.session_id as string;

  SESSION_STORE.createOrGet(context.name, sessionId);

  const existingNativeSessionId = SESSION_STORE.getNativeSessionId(context.name, sessionId);

  if (existingNativeSessionId) {
    const result: SessionFlowState = {
      sessionId,
      prompt: args.prompt as string,
      nativeSessionId: existingNativeSessionId,
      mode: 'tier2-native',
    };

    return result;
  }

  const result: SessionFlowState = {
    sessionId,
    prompt: buildSessionPrompt({
      sessionTurnsText: SESSION_STORE.getPrependContext(context.name, sessionId),
      userContext: args.context,
      prompt: args.prompt as string,
    }),
    mode: 'tier1-prepend',
  };

  return result;
};
