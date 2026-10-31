import { buildCommandFailure, buildExecutionEnv } from './ask-command';
import { recordCall } from '../../provider-metrics';
import { CommandExecutionError, toMcpError } from '../../shared';
import type { ExecutionResult } from '../../shared/command-execution/common';
import type { McpErrorResponse, ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { AskStreamExecutionSummary, StreamNotifier } from '../../streaming/common';
import type { AskExecution, AskToolArgs } from '../common';
import { buildFailureExecution } from '../utils';

type FailedRunInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly extra?: ProgressContext;
  readonly streamNotifier: StreamNotifier;
};

const toErrorResponse = (error: unknown): McpErrorResponse => {
  if (error instanceof CommandExecutionError) return error.toMcpResponse();

  const errorResponse = toMcpError(error);

  return errorResponse;
};

export const buildFailedRunExecution = async (
  failedRunInput: FailedRunInput,
  result: ExecutionResult,
  summary: AskStreamExecutionSummary
): Promise<AskExecution> => {
  const { context, args, extra, streamNotifier } = failedRunInput;
  const env = buildExecutionEnv(context);
  const error = await buildCommandFailure(context, args, env, result);
  const errorResponse = error.toMcpResponse();
  const [firstContent] = errorResponse.content;

  streamNotifier.emitError(firstContent?.type === 'text' ? firstContent.text : error.message, summary);
  await recordCall(context.name, result.executionTimeMs, false);
  const wasCancelled = extra?.signal?.aborted ?? false;
  const wasStopped = result.timedOut || result.signal !== null;

  return buildFailureExecution(errorResponse, wasCancelled, wasStopped);
};

export const buildThrownRunExecution = async (
  failedRunInput: FailedRunInput,
  error: unknown
): Promise<AskExecution> => {
  const { context, streamNotifier } = failedRunInput;
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorResponse = toErrorResponse(error);
  const [firstContent] = errorResponse.content;

  streamNotifier.emitError(firstContent?.type === 'text' ? firstContent.text : errorMessage);
  await recordCall(context.name, 0, false);

  return buildFailureExecution(errorResponse, false);
};
