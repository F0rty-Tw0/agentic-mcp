import { buildCommandFailure, buildExecutionEnv, resolveModelFallback } from './ask-command';
import { buildSuccessfulResponse } from './ask-runner-response.builder';
import { recordCall } from '../../provider-metrics';
import type { ExecutionResult, ProgressContext, ResolvedProviderEntry } from '../../shared';
import { CommandExecutionError, startHeartbeat, toMcpError, unregisterActiveRequest } from '../../shared';
import { buildExecutionSummary, createStreamNotifier } from '../../streaming';
import type { AskStreamExecutionSummary, StreamNotifier } from '../../streaming';
import { noop } from '../common';
import type { AskExecution, AskToolArgs } from '../common';
import { buildExecution, buildFailureExecution } from '../utils';
import { runCommandExecution } from './ask-command-execution';

type RunInvocationInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  extra?: ProgressContext;
  tier2SessionId?: string;
}>;

type ExecuteInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  extra?: ProgressContext;
  tier2SessionId?: string;
  streamNotifier: StreamNotifier;
}>;

const handleFailedExecution = async (
  executeInput: ExecuteInput,
  result: ExecutionResult,
  summary: AskStreamExecutionSummary
): Promise<AskExecution> => {
  const { context, args, extra, streamNotifier } = executeInput;
  const env = buildExecutionEnv(context);
  const error = await buildCommandFailure(context, args, env, result);
  const errorResponse = error.toMcpResponse();
  const [firstContent] = errorResponse.content;

  streamNotifier.emitError(firstContent?.type === 'text' ? firstContent.text : error.message, summary);
  await recordCall(context.name, result.executionTimeMs, false);
  const wasCancelled = extra?.signal?.aborted ?? false;

  return buildFailureExecution(errorResponse, wasCancelled);
};

const executeAndBuildResponse = async (executeInput: ExecuteInput, isRetry = false): Promise<AskExecution> => {
  const { context, args, streamNotifier } = executeInput;
  const { result, outputFormat } = await runCommandExecution(executeInput);
  const summary = buildExecutionSummary(result);

  if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
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
        const retryInput: ExecuteInput = { ...executeInput, args: { ...args, model: fallbackModel } };

        return executeAndBuildResponse(retryInput, true);
      }
    }

    return handleFailedExecution(executeInput, result, summary);
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
  };
  const response = await buildSuccessfulResponse(successResponseInput);

  await recordCall(context.name, result.executionTimeMs, !response.isError);

  return buildExecution(response, result.stdout, outputFormat, context);
};

export const runAskInvocation = async (runInvocationInput: RunInvocationInput): Promise<AskExecution> => {
  const { context, args, extra, tier2SessionId } = runInvocationInput;
  const input = { providerName: context.name, args, extra };
  const streamNotifier = createStreamNotifier(input);
  const stopHeartbeat = streamNotifier.enabled ? noop : startHeartbeat(extra);
  const requestId = extra?.requestId ? String(extra.requestId) : undefined;

  try {
    const executeInput: ExecuteInput = { context, args, extra, tier2SessionId, streamNotifier };

    return await executeAndBuildResponse(executeInput);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorResponse = error instanceof CommandExecutionError ? error.toMcpResponse() : toMcpError(error);
    const [firstContent] = errorResponse.content;

    streamNotifier.emitError(firstContent?.type === 'text' ? firstContent.text : errorMessage);
    await recordCall(context.name, 0, false);

    return buildFailureExecution(errorResponse, false);
  } finally {
    if (requestId) unregisterActiveRequest(requestId);
    stopHeartbeat();
    streamNotifier.stop();
  }
};
