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

// Wording from CommandExecutionError.toMcpResponse: AskExecution carries no timedOut or signal field.
const STOPPED_RUN_MARKERS = ['Process timed out.', 'Killed by signal: '];

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

const buildTier1Prompt = (context: ResolvedProviderEntry, args: AskToolArgs, sessionId: string): string => {
  const sessionTurnsText = SESSION_STORE.getPrependContext(context.name, sessionId);
  const promptText = String(args.prompt);
  const prompt = buildSessionPrompt({ sessionTurnsText, userContext: args.context, prompt: promptText });

  return prompt;
};

const isStoppedByTimeoutOrSignal = (response: CallToolResult): boolean => {
  const texts = response.content.map((item) => (item.type === 'text' ? item.text : ''));
  const responseText = texts.join('\n');
  const result = STOPPED_RUN_MARKERS.some((marker) => responseText.includes(marker));

  return result;
};

const canFallBackToTier1 = (
  execution: SessionFlowResult,
  state: SessionFlowState,
  extra?: ProgressContext
): boolean => {
  if (!execution.response.isError || state.mode !== 'tier2-native') return false;

  const isAborted = extra?.signal?.aborted ?? false;

  if (execution.wasCancelled || isAborted) return false;

  const stoppedByTimeoutOrSignal = isStoppedByTimeoutOrSignal(execution.response);
  const result = !stoppedByTimeoutOrSignal;

  return result;
};

export const executeSessionFlow = async ({
  context,
  args,
  extra,
  state,
}: SessionExecutionInput): Promise<SessionFlowResult> => {
  const firstExecution = await runSessionExecution(context, args, extra, state);
  const shouldFallBack = canFallBackToTier1(firstExecution, state, extra);

  if (!shouldFallBack) return firstExecution;

  const fallbackPrompt = buildTier1Prompt(context, args, state.sessionId);
  const fallbackState: SessionFlowState = {
    ...state,
    prompt: fallbackPrompt,
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

  const prompt = buildTier1Prompt(context, args, sessionId);
  const result: SessionFlowState = {
    sessionId,
    prompt,
    mode: 'tier1-prepend',
  };

  return result;
};
