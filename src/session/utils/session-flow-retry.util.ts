import { stripAnsi } from '../../shared';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { SessionFlowResult, SessionFlowState } from '../common';

// commander: unknown option '--x'; argparse: unrecognized arguments; clap: unexpected argument '--x' found;
// yargs: Unknown argument: x (the flag name without dashes).
const FLAG_REJECTION_PATTERN = /\b(?:unknown|unrecognized|unexpected)\s+(?:option|argument)/i;
const LEADING_DASHES_PATTERN = /^-+/;

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

const buildFlagTokenPattern = (startFlag: string): RegExp => {
  const bareName = startFlag.replace(LEADING_DASHES_PATTERN, '');
  const pattern = new RegExp(`(?<![\\w-])-{0,2}${RegExp.escape(bareName)}(?![\\w-])`);

  return pattern;
};

const isStartFlagRejected = (execution: SessionFlowResult, startFlag: string): boolean => {
  const plainStderr = stripAnsi(execution.stderr ?? '');
  const stderrLines = plainStderr.split(/\r?\n/);
  const flagPattern = buildFlagTokenPattern(startFlag);
  const isRejectionLine = (line: string): boolean => FLAG_REJECTION_PATTERN.test(line) && flagPattern.test(line);
  const result = stderrLines.some(isRejectionLine);

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

export const canSessionFlowRetry = (
  execution: SessionFlowResult,
  state: SessionFlowState,
  startFlag: string | undefined,
  extra?: ProgressContext
): boolean => {
  const result =
    canRetryWithoutStartFlag(execution, state, startFlag, extra) || canFallBackToTier1(execution, state, extra);

  return result;
};
