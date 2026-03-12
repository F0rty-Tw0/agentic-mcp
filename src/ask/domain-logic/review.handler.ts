import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildReviewArgArray } from '../../cli-args';
import type { ExecutionResult, ProgressContext, ResolvedProviderEntry } from '../../shared';
import { executeCommand } from '../../shared';
import { createStreamNotifier } from '../../streaming';
import type { AskStreamExecutionSummary } from '../../streaming';
import type { AskToolArgs, ReviewToolArgs } from '../common';
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

const handleFailedReview = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  env: Readonly<Record<string, string>>,
  result: ExecutionResult
): Promise<CallToolResult> => {
  const error = await buildCommandFailure(context, args, env, result);

  return error.toMcpResponse();
};

export const handleReview = async (
  context: ResolvedProviderEntry,
  args: ReviewToolArgs,
  extra?: ProgressContext
): Promise<CallToolResult> => {
  const env = buildExecutionEnv(context);
  const builtArgs = buildReviewArgArray(context.config, args);
  const responseArgs = buildResponseArgs(args);
  const streamNotifier = createStreamNotifier({ providerName: context.name, args: responseArgs, extra });
  const commandOptions = buildCommandOptions({
    context,
    resolved: responseArgs,
    cliArgs: builtArgs.args,
    stdinInput: builtArgs.stdinInput,
    env,
    onStdoutChunk: streamNotifier.onStdoutChunk,
    onStderrChunk: streamNotifier.onStderrChunk,
    signal: extra?.signal,
  });

  streamNotifier.emitStart();

  try {
    const result = await executeCommand(commandOptions);
    const summary = buildExecutionSummary(result);

    if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
      return await handleFailedReview(context, responseArgs, env, result);
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
    streamNotifier.stop();
  }
};
