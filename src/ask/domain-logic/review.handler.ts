import type { CallToolResult } from '@modelcontextprotocol/server';

import { buildCommandFailure, buildExecutionEnv } from './ask-command';
import { buildOnSpawned, resolveRequestId } from './ask-command-execution';
import { buildSuccessfulResponse } from './ask-runner-response.builder';
import { buildReviewArgArray } from '../../cli-args';
import { executeCommand, unregisterActiveRequest } from '../../shared';
import type { ExecuteCommandOptions, ExecutionResult } from '../../shared/command-execution/common';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import { createStreamNotifier } from '../../streaming';
import type { AskStreamExecutionSummary, StreamNotifier } from '../../streaming/common';
import type { AskToolArgs, BuiltArgs, ReviewToolArgs } from '../common';
import { buildCommandOptions } from '../utils/ask-command.util';

const buildExecutionSummary = (result: ExecutionResult): AskStreamExecutionSummary => {
  const summary: AskStreamExecutionSummary = {
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    truncated: result.truncated,
    stdoutBytes: result.stdoutBytes,
    stderrBytes: result.stderrBytes,
    executionTimeMs: result.executionTimeMs,
  };

  return summary;
};

const buildResponseArgs = (args: ReviewToolArgs): AskToolArgs => {
  const noArgs: AskToolArgs = {};
  const modelArgs: AskToolArgs = { model: args.model };
  const workingDirectoryArgs: AskToolArgs = { working_directory: args.working_directory };
  const streamLiveArgs: AskToolArgs = { stream_live: true };
  const modelPatch = args.model ? modelArgs : noArgs;
  const workingDirectoryPatch = args.working_directory ? workingDirectoryArgs : noArgs;
  const streamLivePatch = args.stream_live === true ? streamLiveArgs : noArgs;
  const responseArgs: AskToolArgs = {
    include_structured: args.include_structured,
    ...modelPatch,
    ...workingDirectoryPatch,
    ...streamLivePatch,
  };

  return responseArgs;
};

type BuildReviewCommandOptionsInput = {
  readonly context: ResolvedProviderEntry;
  readonly responseArgs: AskToolArgs;
  readonly builtArgs: BuiltArgs;
  readonly env: Readonly<Record<string, string>>;
  readonly extra?: ProgressContext;
  readonly streamNotifier: StreamNotifier;
  readonly requestId?: string;
};

type HandleReviewFailureInput = {
  readonly context: ResolvedProviderEntry;
  readonly responseArgs: AskToolArgs;
  readonly env: Readonly<Record<string, string>>;
  readonly result: ExecutionResult;
  readonly summary: AskStreamExecutionSummary;
  readonly streamNotifier: StreamNotifier;
};

const buildReviewCommandOptions = (input: BuildReviewCommandOptionsInput): ExecuteCommandOptions => {
  const { context, responseArgs, builtArgs, env, extra, streamNotifier, requestId } = input;
  const onSpawned = buildOnSpawned(requestId);
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
