import { buildCommandFailure, buildExecutionEnv, resolveModelFallback } from './ask-command';
import { buildSuccessfulResponse } from './ask-runner-response.builder';
import { buildArgArray } from '../../cli-args';
import { recordCall } from '../../provider-metrics';
import type { ExecutionResult, ProgressContext, ResolvedProviderEntry } from '../../shared';
import {
  CommandExecutionError,
  executeCommand,
  registerActiveRequest,
  startHeartbeat,
  toMcpError,
  unregisterActiveRequest,
} from '../../shared';
import { buildExecutionSummary, createStreamNotifier } from '../../streaming';
import type { AskStreamExecutionSummary } from '../../streaming';
import { noop } from '../common';
import type { AskToolArgs } from '../common';
import { buildCommandOptions, buildNativeSessionArgs, validateAndResolveArgs } from '../utils/ask-command.util';
import type { AskExecution } from '../utils/ask-runner-response.util';
import { buildExecution, buildFailureExecution } from '../utils/ask-runner-response.util';
import { resolveRequestedModel } from '../utils/resolve-requested-model.util';

export type { AskExecution } from '../utils/ask-runner-response.util';

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
  streamNotifier: ReturnType<typeof createStreamNotifier>;
}>;

const resolveRequestId = (extra?: ProgressContext): string | undefined =>
  extra?.requestId ? String(extra.requestId) : undefined;

const buildCliArgs = (
  config: ResolvedProviderEntry['config'],
  baseCliArgs: readonly string[],
  tier2SessionId?: string
): string[] => {
  const tier2SessionArgs = tier2SessionId ? buildNativeSessionArgs(config, tier2SessionId) : [];
  const cliArgs = [...baseCliArgs, ...tier2SessionArgs];

  return cliArgs;
};

const handleFailedExecution = async (
  executeInput: ExecuteInput,
  result: ExecutionResult,
  summary: AskStreamExecutionSummary
): Promise<AskExecution> => {
  const { context, args, extra, streamNotifier } = executeInput;
  const env = buildExecutionEnv(context);
  const error = await buildCommandFailure(context, args, env, result);

  streamNotifier.emitError(error.message, summary);
  recordCall(context.name, result.executionTimeMs, false);
  const wasCancelled = extra?.signal?.aborted ?? false;

  return buildFailureExecution(error.toMcpResponse(), wasCancelled);
};

const runExecution = async (executeInput: ExecuteInput): Promise<{ result: ExecutionResult }> => {
  const { context, args, extra, tier2SessionId, streamNotifier } = executeInput;
  const env = buildExecutionEnv(context);
  const remappedArgs = await resolveRequestedModel({ context, args, env });
  const resolved = validateAndResolveArgs(remappedArgs, context.name);
  const { args: baseCliArgs, stdinInput } = buildArgArray(context.config, resolved);
  const requestId = resolveRequestId(extra);
  const cliArgs = buildCliArgs(context.config, baseCliArgs, tier2SessionId);

  streamNotifier.emitStart();

  const onSpawned = requestId ? (pid: number): void => registerActiveRequest(requestId, pid) : undefined;
  const commandOptions = {
    context,
    resolved,
    cliArgs,
    stdinInput,
    env,
    onStdoutChunk: streamNotifier.onStdoutChunk,
    onStderrChunk: streamNotifier.onStderrChunk,
    signal: extra?.signal,
    onSpawned,
  };
  const buildOptions = buildCommandOptions(commandOptions);
  const result = await executeCommand(buildOptions);

  return { result };
};

const executeAndBuildResponse = async (executeInput: ExecuteInput, isRetry = false): Promise<AskExecution> => {
  const { context, args, streamNotifier } = executeInput;
  const { result } = await runExecution(executeInput);
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
    streamNotifier,
    summary,
    sessionMode: 'none' as const,
  };

  const response = await buildSuccessfulResponse(successResponseInput);

  recordCall(context.name, result.executionTimeMs, !response.isError);

  const execution = buildExecution(response, result.stdout, context);

  return execution;
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

    streamNotifier.emitError(errorMessage);
    recordCall(context.name, 0, false);

    if (error instanceof CommandExecutionError) return buildFailureExecution(error.toMcpResponse(), false);

    return buildFailureExecution(toMcpError(error), false);
  } finally {
    if (requestId) unregisterActiveRequest(requestId);
    stopHeartbeat();
    streamNotifier.stop();
  }
};
