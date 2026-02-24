import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildArgArray } from './arg.builder.ts';
import { buildCliArgs, buildOnSpawned, buildRequestId, isExecutionFailure } from './ask-execution-helpers.ts';
import {
  buildCommandFailure,
  buildCommandOptions,
  buildExecutionEnv,
  validateAndResolveArgs,
} from './ask-handler.util.ts';
import { buildSuccessfulResponse } from './ask-success-response.util.ts';
import { extractNativeSessionId } from '../../session/session-id-extractor.ts';
import { CommandExecutionError } from '../../shared/common/errors/index.ts';
import type { ProgressContext, ResolvedProviderEntry } from '../../shared/common/index.ts';
import { executeCommand } from '../../shared/domain-logic/command-executor.ts';
import { unregisterActiveRequest } from '../../shared/domain-logic/request-registry.ts';
import { startHeartbeat, stripAnsi, toMcpError } from '../../shared/utils/index.ts';
import { recordCall } from '../../usage-stats/data-access/usage-stats-store.ts';
import type { AskToolArgs, SessionMode } from '../common/index.ts';
import { buildExecutionSummary, createStreamNotifier } from '../utils/ask-stream-notifier.util.ts';

type RunInvocationInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  extra?: ProgressContext;
  tier2SessionId?: string;
}>;
export type AskExecution = Readonly<{
  response: CallToolResult;
  sessionMode: SessionMode;
  responseText: string;
  nativeSessionId?: string;
  wasCancelled: boolean;
}>;

const noop = (): void => undefined;
const buildFailureExecution = (response: CallToolResult, wasCancelled: boolean): AskExecution => ({
  response,
  sessionMode: 'none',
  responseText: '',
  wasCancelled,
});

type ExecuteInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  extra?: ProgressContext;
  tier2SessionId?: string;
  streamNotifier: ReturnType<typeof createStreamNotifier>;
}>;

const buildExecution = (response: CallToolResult, stdout: string, context: ResolvedProviderEntry): AskExecution => {
  const firstContent = response.content[0];

  return {
    response,
    sessionMode: 'none',
    responseText: firstContent?.type === 'text' ? firstContent.text : '',
    nativeSessionId: extractNativeSessionId(context.name, stripAnsi(stdout), context.config.outputFormat),
    wasCancelled: false,
  };
};

const executeAndBuildResponse = async ({
  context,
  args,
  extra,
  tier2SessionId,
  streamNotifier,
}: ExecuteInput): Promise<AskExecution> => {
  const resolved = validateAndResolveArgs(args);
  const { args: baseCliArgs, stdinInput } = buildArgArray(context.config, resolved);
  const env = buildExecutionEnv(context);
  const requestId = buildRequestId(extra);
  const cliArgs = buildCliArgs(baseCliArgs, context, tier2SessionId);

  streamNotifier.emitStart();
  const result = await executeCommand(
    buildCommandOptions({
      context,
      resolved,
      cliArgs,
      stdinInput,
      env,
      onStdoutChunk: streamNotifier.onStdoutChunk,
      onStderrChunk: streamNotifier.onStderrChunk,
      signal: extra?.signal,
      onSpawned: buildOnSpawned(requestId),
    })
  );
  const summary = buildExecutionSummary(result);

  if (isExecutionFailure(result)) {
    const error = await buildCommandFailure(context, args, env, result);

    streamNotifier.emitError(error.message, summary);
    recordCall(context.name, result.executionTimeMs, false);

    return buildFailureExecution(error.toMcpResponse(), extra?.signal?.aborted ?? false);
  }

  const response = await buildSuccessfulResponse({
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
    sessionMode: 'none',
  });

  recordCall(context.name, result.executionTimeMs, !response.isError);

  return buildExecution(response, result.stdout, context);
};

export const runAskInvocation = async ({
  context,
  args,
  extra,
  tier2SessionId,
}: RunInvocationInput): Promise<AskExecution> => {
  const streamNotifier = createStreamNotifier({ providerName: context.name, args, extra });
  const stopHeartbeat = streamNotifier.enabled ? noop : startHeartbeat(extra);
  const requestId = buildRequestId(extra);

  try {
    return await executeAndBuildResponse({ context, args, extra, tier2SessionId, streamNotifier });
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
