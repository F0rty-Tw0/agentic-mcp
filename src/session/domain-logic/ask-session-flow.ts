import { randomUUID } from 'node:crypto';

import type { CallToolResult } from '@modelcontextprotocol/server';

import type { AskToolArgs } from '../../ask/common';
import { runAskInvocation } from '../../ask/domain-logic/ask-runner';
import { canStartNativeSession } from '../../ask/utils/session-flag-args.util';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared/provider/common';
import { ValidationError } from '../../shared/validation/common';
import type { SessionMode } from '../common';
import { SESSION_STORE } from '../data-access';
import { buildSessionPrompt } from '../utils/session-context.util';

type SessionFlowState = {
  readonly sessionId: string;
  readonly prompt?: string;
  readonly nativeSessionId?: string;
  readonly startSessionId?: string;
  readonly mode: SessionMode;
};

type SessionFlowResult = {
  readonly response: CallToolResult;
  readonly responseText: string;
  readonly nativeSessionId?: string;
  readonly sessionMode: SessionMode;
  readonly wasCancelled: boolean;
  readonly wasStopped?: boolean;
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
    startSessionId: state.startSessionId,
  });
  const nativeSessionId = state.startSessionId ?? execution.nativeSessionId;
  const result: SessionFlowResult = { ...execution, nativeSessionId, sessionMode: state.mode };

  return result;
};

const buildTier1Prompt = (context: ResolvedProviderEntry, args: AskToolArgs, sessionId: string): string => {
  const sessionTurnsText = SESSION_STORE.getPrependContext(context.name, sessionId);
  const promptText = String(args.prompt);
  const prompt = buildSessionPrompt({ sessionTurnsText, userContext: args.context, prompt: promptText });

  return prompt;
};

const canFallBackToTier1 = (
  execution: SessionFlowResult,
  state: SessionFlowState,
  extra?: ProgressContext
): boolean => {
  if (!execution.response.isError || state.mode !== 'tier2-native') return false;

  const isAborted = extra?.signal?.aborted ?? false;

  const wasStopped = execution.wasStopped ?? false;
  const result = !execution.wasCancelled && !isAborted && !wasStopped;

  return result;
};

const buildMissingPromptResult = (state: SessionFlowState): SessionFlowResult => {
  const error = new ValidationError('Prompt is required');
  const response = error.toMcpResponse();
  const result: SessionFlowResult = { response, responseText: '', sessionMode: state.mode, wasCancelled: false };

  return result;
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

const resolveStartSessionId = (config: ProviderConfig): string | undefined => {
  const candidateId = randomUUID();
  const canStart = canStartNativeSession(config, candidateId);

  if (!canStart) return;

  return candidateId;
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
  const startSessionId = resolveStartSessionId(context.config);
  const tier1State: SessionFlowState = { sessionId, prompt, mode: 'tier1-prepend' };
  const startState: SessionFlowState = { ...tier1State, startSessionId };
  const result = startSessionId ? startState : tier1State;

  return result;
};
