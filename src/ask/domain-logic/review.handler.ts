import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildReviewArgArray } from '../../cli-args';
import type { ExecuteCommandOptions, ExecutionResult, ProgressContext, ResolvedProviderEntry } from '../../shared';
import { executeCommand, registerActiveRequest, unregisterActiveRequest } from '../../shared';
import { createStreamNotifier } from '../../streaming';
import type { AskStreamExecutionSummary, StreamNotifier } from '../../streaming';
import type { AskToolArgs, BuiltArgs, ReviewToolArgs } from '../common';
import { buildCommandFailure, buildExecutionEnv } from './ask-command';
import { buildSuccessfulResponse } from './ask-runner-response.builder';
import { buildCommandOptions } from '../utils/ask-command.util';

const buildExecutionSummary = (result: ExecutionResult): AskStreamExecutionSummary => ({
  exitCode: result.exitCode,
  signal: result.signal,
  timedOut: result.timedOut,
  truncated: result.truncated,
  stdoutBytes: result.stdoutBytes,
  stderrBytes: result.stderrBytes,
  executionTimeMs: result.executionTimeMs,
});

const buildResponseArgs = (args: ReviewToolArgs): AskToolArgs => {
  const responseArgs: AskToolArgs = {
    include_structured: args.include_structured,
    ...(args.model ? { model: args.model } : {}),
    ...(args.working_directory ? { working_directory: args.working_directory } : {}),
    ...(args.stream_live === true ? { stream_live: true } : {}),
  };

  return responseArgs;
};

const resolveRequestId = (extra?: ProgressContext): string | undefined =>
  extra?.requestId ? String(extra.requestId) : undefined;

type BuildReviewCommandOptionsInput = Readonly<{
  context: ResolvedProviderEntry;
  responseArgs: AskToolArgs;
  builtArgs: BuiltArgs;
  env: Readonly<Record<string, string>>;
  extra?: ProgressContext;
  streamNotifier: StreamNotifier;
  requestId?: string;
}>;

type HandleReviewFailureInput = Readonly<{
  context: ResolvedProviderEntry;
  responseArgs: AskToolArgs;
  env: Readonly<Record<string, string>>;
  result: ExecutionResult;
  summary: AskStreamExecutionSummary;
  streamNotifier: StreamNotifier;
}>;

const buildReviewCommandOptions = (input: BuildReviewCommandOptionsInput): ExecuteCommandOptions => {
  const { context, responseArgs, builtArgs, env, extra, streamNotifier, requestId } = input;
  const onSpawned = requestId ? (pid: number): void => registerActiveRequest(requestId, pid) : undefined;
  const commandOptions = buildCommandOptions({
    context,
    resolved: responseArgs,
    cliArgs: builtArgs.args,
    stdinInput: builtArgs.stdinInput,
    env,
    onStdoutChunk: streamNotifier.onStdoutChunk,
    onStderrChunk: streamNotifier.onStderrChunk,
    signal: extra?.signal,
    onSpawned,
  });

  return commandOptions;
};

const buildFailedReviewResponse = async (input: HandleReviewFailureInput): Promise<CallToolResult> => {
  const { context, responseArgs, env, result, summary, streamNotifier } = input;
  const error = await buildCommandFailure(context, responseArgs, env, result);
  const failedReview = error.toMcpResponse();
  const [firstContent] = failedReview.content;
  const errorText = firstContent?.type === 'text' ? firstContent.text : 'Review failed';

  streamNotifier.emitError(errorText, summary);

  return failedReview;
};

export const handleReview = async (
  context: ResolvedProviderEntry,
  args: ReviewToolArgs,
  extra?: ProgressContext
): Promise<CallToolResult> => {
  const env = buildExecutionEnv(context);
  const builtArgs = buildReviewArgArray(context.config, args);
  const responseArgs = buildResponseArgs(args);
  const requestId = resolveRequestId(extra);
  const streamNotifier = createStreamNotifier({ providerName: context.name, args: responseArgs, extra });
  const commandOptions = buildReviewCommandOptions({
    context,
    responseArgs,
    builtArgs,
    env,
    extra,
    streamNotifier,
    requestId,
  });

  streamNotifier.emitStart();

  try {
    const result = await executeCommand(commandOptions);
    const summary = buildExecutionSummary(result);

    if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
      return await buildFailedReviewResponse({ context, responseArgs, env, result, summary, streamNotifier });
    }

    return await buildSuccessfulResponse({
      context,
      args: responseArgs,
      env,
      stdout: result.stdout,
      stderr: result.stderr,
      executionTimeMs: result.executionTimeMs,
      truncated: result.truncated,
      stdoutBytes: result.stdoutBytes,
      outputFormat: builtArgs.outputFormat,
      streamNotifier,
      summary,
      sessionMode: 'none',
    });
  } finally {
    if (requestId) unregisterActiveRequest(requestId);

    streamNotifier.stop();
  }
};
