import { buildExecutionEnv, resolveModelFallback } from './ask-command';
import { runCommandExecution } from './ask-command-execution';
import { startAskHeartbeat } from './ask-heartbeat';
import { buildFailedRunExecution, buildThrownRunExecution } from './ask-runner-failure';
import { buildSuccessfulResponse } from './ask-runner-response.builder';
import { recordCall } from '../../provider-metrics';
import type { ExecutionResult } from '../../shared/command-execution/common';
import type { OutputFormat, ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import { buildExecutionSummary, createStreamNotifier, holdStreamError } from '../../streaming';
import type { StreamNotifier } from '../../streaming/common';
import type { AskExecution, AskToolArgs, ResultWarnings } from '../common';
import { buildExecution } from '../utils';
import { resolveResultWarnings } from '../utils/complete-result.util';

type RunInvocationInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly extra?: ProgressContext;
  readonly tier2SessionId?: string;
  readonly startSessionId?: string;
  readonly willRetry?: (execution: AskExecution) => boolean;
};

type ExecuteInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly extra?: ProgressContext;
  readonly tier2SessionId?: string;
  readonly startSessionId?: string;
  readonly streamNotifier: StreamNotifier;
};

type FinishedExecution = Pick<ExecutionResult, 'exitCode' | 'signal' | 'timedOut'>;

const isFailedExecution = (result: FinishedExecution, acceptedWarning?: string): boolean => {
  if (acceptedWarning !== undefined) return false;

  const hasFailed = result.timedOut || result.signal !== null || result.exitCode !== 0;

  return hasFailed;
};

const resolveWarnings = (
  executeInput: ExecuteInput,
  outputFormat: OutputFormat,
  result: ExecutionResult
): ResultWarnings => {
  const { context, extra } = executeInput;
  const wasCancelled = extra?.signal?.aborted ?? false;
  const warnings = resolveResultWarnings({
    providerName: context.name,
    config: context.config,
    result,
    outputFormat,
    wasCancelled,
  });

  return warnings;
};

const executeAndBuildResponse = async (executeInput: ExecuteInput, isRetry = false): Promise<AskExecution> => {
  const { context, args, streamNotifier } = executeInput;
  const { result, outputFormat } = await runCommandExecution(executeInput);
  const summary = buildExecutionSummary(result);
  const { acceptedWarning, warning } = resolveWarnings(executeInput, outputFormat, result);
  const hasFailed = isFailedExecution(result, acceptedWarning);

  if (hasFailed) {
    if (!isRetry) {
      const env = buildExecutionEnv(context);
      const fallbackModel = await resolveModelFallback({
        context,
        args,
        stdout: result.stdout,
        stderr: result.stderr,
        env,
      });

      if (fallbackModel) {
        const retryArgs: AskToolArgs = { ...args, model: fallbackModel };
        const retryInput: ExecuteInput = { ...executeInput, args: retryArgs };

        return executeAndBuildResponse(retryInput, true);
      }
    }

    return buildFailedRunExecution(executeInput, result, summary);
  }

  const env = buildExecutionEnv(context);
  const successResponseInput = {
    context,
    args,
    env,
    stdout: result.stdout,
    stderr: result.stderr,
    executionTimeMs: result.executionTimeMs,
    truncated: result.truncated,
    stdoutBytes: result.stdoutBytes,
    outputFormat,
    streamNotifier,
    summary,
    sessionMode: 'none' as const,
    warning,
  };
  const response = await buildSuccessfulResponse(successResponseInput);

  await recordCall(context.name, result.executionTimeMs, !response.isError);

  return buildExecution(response, result.stdout, outputFormat, context);
};

const executeOrFail = async (executeInput: ExecuteInput): Promise<AskExecution> => {
  try {
    return await executeAndBuildResponse(executeInput);
  } catch (error) {
    const execution = await buildThrownRunExecution(executeInput, error);

    return execution;
  }
};

// A run the caller will retry keeps its terminal error off the stream; the retry's own run ends the stream.
export const runAskInvocation = async (runInvocationInput: RunInvocationInput): Promise<AskExecution> => {
  const { context, args, extra, tier2SessionId, startSessionId, willRetry } = runInvocationInput;
  const input = { providerName: context.name, args, extra };
  const liveNotifier = createStreamNotifier(input);
  const { notifier: streamNotifier, releaseError } = holdStreamError(liveNotifier);
  const stopHeartbeat = startAskHeartbeat(streamNotifier, extra);

  try {
    const executeInput: ExecuteInput = { context, args, extra, tier2SessionId, startSessionId, streamNotifier };
    const execution = await executeOrFail(executeInput);
    const isRetried = willRetry?.(execution) ?? false;

    if (!isRetried) releaseError();

    return execution;
  } finally {
    stopHeartbeat();
    streamNotifier.stop();
  }
};
