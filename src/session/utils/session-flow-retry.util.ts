import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { SessionFlowResult, SessionFlowState } from '../common';

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

export const canRetryWithoutStartFlag = (
  execution: SessionFlowResult,
  state: SessionFlowState,
  extra?: ProgressContext
): boolean => {
  if (!execution.response.isError || !state.startSessionId) return false;

  const result = !wasInterrupted(execution, extra);

  return result;
};
