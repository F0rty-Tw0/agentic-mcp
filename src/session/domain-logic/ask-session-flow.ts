import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { AskToolArgs } from '../../ask/common';
import { runAskInvocation } from '../../ask/domain-logic/ask-runner';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { SessionMode } from '../common';
import { SESSION_STORE } from '../data-access';
import { buildSessionPrompt } from '../utils/session-context.util';

type SessionFlowState = {
  readonly sessionId: string;
  readonly prompt?: string;
  readonly nativeSessionId?: string;
  readonly mode: SessionMode;
};

type SessionFlowResult = {
  readonly response: CallToolResult;
  readonly responseText: string;
  readonly nativeSessionId?: string;
  readonly sessionMode: SessionMode;
  readonly wasCancelled: boolean;
};

type SessionExecutionInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly extra?: ProgressContext;
  readonly state: SessionFlowState;
};

const runSessionExecution = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  extra: ProgressContext | undefined,
  state: SessionFlowState
): Promise<SessionFlowResult> => {
  const promptArgs: AskToolArgs = { ...args, prompt: state.prompt };
  const execution = await runAskInvocation({
    context,
    args: promptArgs,
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

  if (!firstExecution.response.isError || state.mode !== 'tier2-native') return firstExecution;

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
  const { session_id: sessionId = '' } = args;

  SESSION_STORE.createOrGet(context.name, sessionId);

  const existingNativeSessionId = SESSION_STORE.getNativeSessionId(context.name, sessionId);

  if (existingNativeSessionId) {
    const result: SessionFlowState = {
      sessionId,
      prompt: args.prompt,
      nativeSessionId: existingNativeSessionId,
      mode: 'tier2-native',
    };

    return result;
  }

  const sessionTurnsText = SESSION_STORE.getPrependContext(context.name, sessionId);
  const promptText = String(args.prompt);
  const prompt = buildSessionPrompt({ sessionTurnsText, userContext: args.context, prompt: promptText });
  const result: SessionFlowState = {
    sessionId,
    prompt,
    mode: 'tier1-prepend',
  };

  return result;
};
