import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { SESSION_STORE } from '../../../session';
import type { ProgressContext, ResolvedProviderEntry } from '../../../shared';
import type { AskToolArgs, SessionMode } from '../../common';
import { runAskInvocation } from '../../domain-logic/ask-runner';
import { buildSessionPrompt } from '../utils/session-context.util';

export type SessionFlowState = Readonly<{
  sessionId: string;
  prompt: string;
  nativeSessionId?: string;
  mode: SessionMode;
}>;

export type SessionFlowResult = Readonly<{
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

export const executeSessionFlow = async ({
  context,
  args,
  extra,
  state,
}: SessionExecutionInput): Promise<SessionFlowResult> => {
  const runOnce = async (currentState: SessionFlowState): Promise<SessionFlowResult> => {
    const execution = await runAskInvocation({
      context,
      args: { ...args, prompt: currentState.prompt },
      extra,
      tier2SessionId: currentState.nativeSessionId,
    });

    return { ...execution, sessionMode: currentState.mode };
  };

  const firstExecution = await runOnce(state);

  if (!firstExecution.response.isError || state.mode !== 'tier2-native') {
    return {
      response: firstExecution.response,
      responseText: firstExecution.responseText,
      nativeSessionId: firstExecution.nativeSessionId,
      sessionMode: firstExecution.sessionMode,
      wasCancelled: firstExecution.wasCancelled,
    };
  }

  const fallbackExecution = await runOnce({ ...state, mode: 'tier2-fallback-to-tier1', nativeSessionId: undefined });

  return {
    response: fallbackExecution.response,
    responseText: fallbackExecution.responseText,
    nativeSessionId: fallbackExecution.nativeSessionId,
    sessionMode: 'tier2-fallback-to-tier1',
    wasCancelled: fallbackExecution.wasCancelled,
  };
};

export const buildSessionFlowState = (context: ResolvedProviderEntry, args: AskToolArgs): SessionFlowState => {
  const sessionId = args.session_id as string;

  SESSION_STORE.createOrGet(context.name, sessionId);

  const existingNativeSessionId = SESSION_STORE.getNativeSessionId(context.name, sessionId);

  if (existingNativeSessionId) {
    return {
      sessionId,
      prompt: args.prompt as string,
      nativeSessionId: existingNativeSessionId,
      mode: 'tier2-native',
    };
  }

  return {
    sessionId,
    prompt: buildSessionPrompt({
      sessionTurnsText: SESSION_STORE.getPrependContext(context.name, sessionId),
      userContext: args.context,
      prompt: args.prompt as string,
    }),
    mode: 'tier1-prepend',
  };
};
