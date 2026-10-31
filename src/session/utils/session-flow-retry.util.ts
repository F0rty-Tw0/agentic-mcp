import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { SessionFlowResult, SessionFlowState } from '../common';

const UNKNOWN_OPTION_PATTERN = /\b(?:unknown|unrecognized)\s+(?:option|argument)/i;

const wasInterrupted = (execution: SessionFlowResult, extra?: ProgressContext): boolean => {
  const isAborted = extra?.signal?.aborted ?? false;
  const wasStopped = execution.wasStopped ?? false;
  const result = execution.wasCancelled || isAborted || wasStopped;

  return result;
};

export const canFallBackToTier1 = (
  execution: SessionFlowResult,
  state: SessionFlowState,
  extra?: ProgressContext
): boolean => {
  if (!execution.response.isError || state.mode !== 'tier2-native') return false;

  const result = !wasInterrupted(execution, extra);

  return result;
};

const isStartFlagRejected = (execution: SessionFlowResult, startFlag: string): boolean => {
  const textParts = execution.response.content.filter((part) => part.type === 'text');
  const lines = textParts.flatMap((part) => part.text.split(/\r?\n/));
  const result = lines.some((line) => UNKNOWN_OPTION_PATTERN.test(line) && line.includes(startFlag));

  return result;
};

export const canRetryWithoutStartFlag = (
  execution: SessionFlowResult,
  state: SessionFlowState,
  startFlag: string | undefined,
  extra?: ProgressContext
): boolean => {
  if (!execution.response.isError || !state.startSessionId || !startFlag) return false;

  const isInterrupted = wasInterrupted(execution, extra);

  if (isInterrupted) return false;

  const result = isStartFlagRejected(execution, startFlag);

  return result;
};
