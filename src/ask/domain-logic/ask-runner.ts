import { buildExecution, buildFailureExecution, buildSuccessfulResponse } from './ask-runner-response.util';
import type { AskExecution } from './ask-runner-response.util';
import { recordCall } from '../../provider-metrics/data-access/provider-metrics-store';
import type { ProgressContext, ResolvedProviderEntry } from '../../shared/common';
import { CommandExecutionError } from '../../shared/common/errors';
import { executeCommand } from '../../shared/domain-logic/command-executor';
import { registerActiveRequest, unregisterActiveRequest } from '../../shared/domain-logic/request-registry';
import { startHeartbeat, toMcpError } from '../../shared/utils';
import { buildExecutionSummary, createStreamNotifier } from '../../streaming/domain-logic';
import { buildArgArray } from '../cli-args';
import { noop } from '../common';
import type { AskToolArgs } from '../common';
import { buildCommandFailure, buildExecutionEnv } from './ask-command';
import { buildCommandOptions, buildNativeSessionArgs, validateAndResolveArgs } from '../utils/ask-command.util';

export type { AskExecution } from './ask-runner-response.util';

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

const executeAndBuildResponse = async (executeInput: ExecuteInput): Promise<AskExecution> => {
  const { context, args, extra, tier2SessionId, streamNotifier } = executeInput;
  const resolved = validateAndResolveArgs(args);
  const { args: baseCliArgs, stdinInput } = buildArgArray(context.config, resolved);
  const env = buildExecutionEnv(context);
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

  const summary = buildExecutionSummary(result);

  if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
    const error = await buildCommandFailure(context, args, env, result);

    streamNotifier.emitError(error.message, summary);
    recordCall(context.name, result.executionTimeMs, false);

    return buildFailureExecution(error.toMcpResponse(), extra?.signal?.aborted ?? false);
  }

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

  return buildExecution(response, result.stdout, context);
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
    streamNotifier.emitError(error instanceof Error ? error.message : 'Unknown error');
    recordCall(context.name, 0, false);

    if (error instanceof CommandExecutionError) return buildFailureExecution(error.toMcpResponse(), false);

    return buildFailureExecution(toMcpError(error), false);
  } finally {
    if (requestId) unregisterActiveRequest(requestId);
    stopHeartbeat();
    streamNotifier.stop();
  }
};
