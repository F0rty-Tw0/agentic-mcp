import { randomUUID } from 'node:crypto';

import type { AskToolArgs } from '../../ask/common';
import { runAskInvocation } from '../../ask/domain-logic/ask-runner';
import { canStartNativeSession } from '../../ask/utils/session-flag-args.util';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import { ValidationError } from '../../shared/validation/common';
import type { SessionFlowResult, SessionFlowState } from '../common';
import { SESSION_STORE } from '../data-access';
import { buildSessionPrompt } from '../utils/session-context.util';
import { canFallBackToTier1, canRetryWithoutStartFlag } from '../utils/session-flow-retry.util';

type SessionExecutionInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly extra?: ProgressContext;
  readonly state: SessionFlowState;
};

const runSingleExecution = async (
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
    startSessionId: state.startSessionId,
  });
  const nativeSessionId = state.startSessionId ?? execution.nativeSessionId;
  const result: SessionFlowResult = { ...execution, nativeSessionId, sessionMode: state.mode };

  return result;
};

// A CLI that rejects the start flag (copilot before 1.0.51) fails the run; one retry without it replays as before.
const runSessionExecution = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  extra: ProgressContext | undefined,
  state: SessionFlowState
): Promise<SessionFlowResult> => {
  const execution = await runSingleExecution(context, args, extra, state);
  const shouldRetry = canRetryWithoutStartFlag(execution, state, extra);

  if (!shouldRetry) return execution;

  const retryState: SessionFlowState = { ...state, startSessionId: undefined };
  const retryExecution = await runSingleExecution(context, args, extra, retryState);
  const result: SessionFlowResult = { ...retryExecution, hasDroppedStartFlag: true };

  return result;
};

const buildTier1Prompt = (context: ResolvedProviderEntry, args: AskToolArgs, sessionId: string): string => {
  const sessionTurnsText = SESSION_STORE.getPrependContext(context.name, sessionId);
  const promptText = String(args.prompt);
  const prompt = buildSessionPrompt({ sessionTurnsText, userContext: args.context, prompt: promptText });

  return prompt;
};

const buildMissingPromptResult = (state: SessionFlowState): SessionFlowResult => {
  const error = new ValidationError('Prompt is required');
  const response = error.toMcpResponse();
  const result: SessionFlowResult = { response, responseText: '', sessionMode: state.mode, wasCancelled: false };

  return result;
};

const resolveStartSessionId = (context: ResolvedProviderEntry, sessionId: string): string | undefined => {
  const isStartDisabled = SESSION_STORE.isNativeStartDisabled(context.name, sessionId);

  if (isStartDisabled) return;

  const candidateId = randomUUID();
  const canStart = canStartNativeSession(context.config, candidateId);

  if (!canStart) return;

  return candidateId;
};

export const executeSessionFlow = async ({
  context,
  args,
  extra,
  state,
}: SessionExecutionInput): Promise<SessionFlowResult> => {
  if (!args.prompt) return buildMissingPromptResult(state);

  const firstExecution = await runSessionExecution(context, args, extra, state);
  const shouldFallBack = canFallBackToTier1(firstExecution, state, extra);

  if (!shouldFallBack) return firstExecution;

  const fallbackPrompt = buildTier1Prompt(context, args, state.sessionId);
  const fallbackState: SessionFlowState = {
    ...state,
    prompt: fallbackPrompt,
    mode: 'tier2-fallback-to-tier1',
    nativeSessionId: undefined,
    startSessionId: resolveStartSessionId(context, state.sessionId),
  };
  const fallbackExecution = await runSessionExecution(context, args, extra, fallbackState);
  const result: SessionFlowResult = {
    response: fallbackExecution.response,
    responseText: fallbackExecution.responseText,
    nativeSessionId: fallbackExecution.nativeSessionId,
    sessionMode: 'tier2-fallback-to-tier1',
    wasCancelled: fallbackExecution.wasCancelled,
    hasDroppedStartFlag: fallbackExecution.hasDroppedStartFlag,
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
  const startSessionId = resolveStartSessionId(context, sessionId);
  const tier1State: SessionFlowState = { sessionId, prompt, mode: 'tier1-prepend' };
  const startState: SessionFlowState = { ...tier1State, startSessionId };
  const result = startSessionId ? startState : tier1State;

  return result;
};
