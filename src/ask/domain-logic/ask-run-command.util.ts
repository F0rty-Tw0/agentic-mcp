import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildArgArray } from './arg.builder.ts';
import { buildCliArgs, buildOnSpawned, buildRequestId, isExecutionFailure } from './ask-execution-helpers.util.ts';
import { buildFailureExecutionResult } from './ask-failure-execution.util.ts';
import {
  buildCappedOutput,
  buildCommandOptions,
  buildExecutionEnv,
  resolveModelHint,
  validateAndResolveArgs,
} from './ask-handler.util.ts';
import type { AskExecution } from './ask-runner.util.ts';
import type { createStreamNotifier } from './ask-stream-notifier.util.ts';
import { buildExecutionSummary } from './ask-stream-notifier.util.ts';
import { parseProviderOutput } from './output-parser.util.ts';
import { extractNativeSessionId } from '../../session/session-id-extractor.ts';
import type { ExecutionResult, ResolvedProviderEntry } from '../../shared/common/index.ts';
import { executeCommand } from '../../shared/domain-logic/command-executor.ts';
import { stripAnsi } from '../../shared/utils/index.ts';
import type { AskToolArgs, ProgressContext, SessionMode } from '../common/index.ts';

type SuccessResponseInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  env: Readonly<Record<string, string>>;
  stdout: string;
  stderr: string;
  streamNotifier: ReturnType<typeof createStreamNotifier>;
  summary: ReturnType<typeof buildExecutionSummary>;
  sessionMode: SessionMode;
}>;
type ExecuteAndBuildResponseInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  extra?: ProgressContext;
  tier2SessionId?: string;
  streamNotifier: ReturnType<typeof createStreamNotifier>;
  buildFailureExecution: (response: CallToolResult, wasCancelled: boolean) => AskExecution;
}>;
type BuildSuccessExecutionInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  env: Readonly<Record<string, string>>;
  result: ExecutionResult;
  streamNotifier: ReturnType<typeof createStreamNotifier>;
  summary: ReturnType<typeof buildExecutionSummary>;
}>;

const buildSuccessfulResponse = async ({
  context,
  args,
  env,
  stdout,
  stderr,
  streamNotifier,
  summary,
  sessionMode,
}: SuccessResponseInput): Promise<CallToolResult> => {
  const parsedOutput = parseProviderOutput(stdout, context.config.outputFormat);
  const modelHint = await resolveModelHint({ context, args, stdout: parsedOutput.text, stderr, env });

  if (modelHint) {
    streamNotifier.emitError('Model validation failed', summary);

    return { isError: true, content: [{ type: 'text', text: parsedOutput.text + modelHint }] };
  }

  streamNotifier.emitDone(summary);
  const content = [{ type: 'text' as const, text: buildCappedOutput(parsedOutput.text) || '(no output)' }];

  if (parsedOutput.metadata || sessionMode !== 'none') {
    content.push({
      type: 'text',
      text: JSON.stringify(
        {
          sessionMode,
          ...(parsedOutput.metadata ? { outputFormatObserved: parsedOutput.metadata.outputFormatObserved } : {}),
        },
        null,
        2
      ),
    });
  }

  return { content };
};

const buildSuccessExecutionResult = async ({
  context,
  args,
  env,
  result,
  streamNotifier,
  summary,
}: BuildSuccessExecutionInput): Promise<AskExecution> => {
  const response = await buildSuccessfulResponse({
    context,
    args,
    env,
    stdout: result.stdout,
    stderr: result.stderr,
    streamNotifier,
    summary,
    sessionMode: 'none',
  });
  const firstContent = response.content[0];

  return {
    response,
    sessionMode: 'none',
    responseText: firstContent?.type === 'text' ? firstContent.text : '',
    nativeSessionId: extractNativeSessionId(context.name, stripAnsi(result.stdout), context.config.outputFormat),
    wasCancelled: false,
  };
};

export const executeAndBuildResponse = async ({
  context,
  args,
  extra,
  tier2SessionId,
  streamNotifier,
  buildFailureExecution,
}: ExecuteAndBuildResponseInput): Promise<AskExecution> => {
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
    return buildFailureExecutionResult({
      context,
      args,
      env,
      result,
      streamNotifier,
      summary,
      buildFailureExecution,
      signal: extra?.signal,
    });
  }

  return buildSuccessExecutionResult({ context, args, env, result, streamNotifier, summary });
};
