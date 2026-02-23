import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildArgArray } from './arg.builder.ts';
import {
  buildCappedOutput,
  buildCommandFailure,
  buildCommandOptions,
  buildExecutionEnv,
  buildNativeSessionArgs,
  resolveModelHint,
  validateAndResolveArgs,
} from './ask-handler.util.ts';
import { buildExecutionSummary, createStreamNotifier } from './ask-stream-notifier.util.ts';
import { buildAttribution } from './attribution.builder.ts';
import { parseProviderOutput } from './output-parser.util.ts';
import { extractNativeSessionId } from '../../session/session-id-extractor.ts';
import { CommandExecutionError } from '../../shared/common/index.ts';
import type { ResolvedProviderEntry } from '../../shared/common/index.ts';
import { executeCommand } from '../../shared/domain-logic/command-executor.ts';
import { registerActiveRequest, unregisterActiveRequest } from '../../shared/domain-logic/request-registry.ts';
import { startHeartbeat, stripAnsi, toMcpError } from '../../shared/utils/index.ts';
import { recordCall } from '../../usage-stats/data-access/usage-stats-store.ts';
import type { AskToolArgs, ProgressContext, SessionMode } from '../common/index.ts';

type Env = Readonly<Record<string, string>>;
type Notifier = ReturnType<typeof createStreamNotifier>;
type Summary = ReturnType<typeof buildExecutionSummary>;
type RunInvocationInput = Readonly<{ context: ResolvedProviderEntry; args: AskToolArgs; extra?: ProgressContext; tier2SessionId?: string }>;
type SuccessResponseInput = Readonly<{
  context: ResolvedProviderEntry; args: AskToolArgs; env: Env; stdout: string; stderr: string;
  executionTimeMs: number; truncated: boolean; stdoutBytes: number; streamNotifier: Notifier; summary: Summary; sessionMode: SessionMode;
}>;
export type AskExecution = Readonly<{ response: CallToolResult; sessionMode: SessionMode; responseText: string; nativeSessionId?: string; wasCancelled: boolean }>;

const noop = (): void => undefined;
const buildFailureExecution = (response: CallToolResult, wasCancelled: boolean): AskExecution => ({
  response,
  sessionMode: 'none',
  responseText: '',
  wasCancelled,
});

const buildSuccessfulResponse = async ({
  context,
  args,
  env,
  stdout,
  stderr,
  executionTimeMs,
  truncated,
  stdoutBytes,
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
  const attribution = buildAttribution({
    provider: context.name,
    model: args.model,
    result: { executionTimeMs, truncated, stdoutBytes },
    outputFormat: context.config.outputFormat,
    metadata: parsedOutput.metadata,
    sessionMode,
  });
  const content = [
    { type: 'text' as const, text: buildCappedOutput(parsedOutput.text) || '(no output)' },
    { type: 'text' as const, text: JSON.stringify(attribution, null, 2) },
  ];

  return { content };
};

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

const resolveRequestId = (extra?: ProgressContext): string | undefined =>
  extra?.requestId !== undefined ? String(extra.requestId) : undefined;

const buildCliArgs = (config: ResolvedProviderEntry['config'], baseCliArgs: readonly string[], tier2SessionId?: string): string[] =>
  [...baseCliArgs, ...(tier2SessionId ? buildNativeSessionArgs(config, tier2SessionId) : [])];

const executeAndBuildResponse = async ({ context, args, extra, tier2SessionId, streamNotifier }: ExecuteInput): Promise<AskExecution> => {
  const resolved = validateAndResolveArgs(args);
  const { args: baseCliArgs, stdinInput } = buildArgArray(context.config, resolved);
  const env = buildExecutionEnv(context);
  const requestId = resolveRequestId(extra);
  const cliArgs = buildCliArgs(context.config, baseCliArgs, tier2SessionId);

  streamNotifier.emitStart();
  const result = await executeCommand(buildCommandOptions({
    context, resolved, cliArgs, stdinInput, env,
    onStdoutChunk: streamNotifier.onStdoutChunk,
    onStderrChunk: streamNotifier.onStderrChunk,
    signal: extra?.signal,
    onSpawned: requestId ? (pid: number): void => registerActiveRequest(requestId, pid) : undefined,
  }));

  const summary = buildExecutionSummary(result);

  if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
    const error = await buildCommandFailure(context, args, env, result);

    streamNotifier.emitError(error.message, summary);
    recordCall(context.name, result.executionTimeMs, false);

    return buildFailureExecution(error.toMcpResponse(), extra?.signal?.aborted ?? false);
  }

  const response = await buildSuccessfulResponse({
    context, args, env, stdout: result.stdout, stderr: result.stderr,
    executionTimeMs: result.executionTimeMs, truncated: result.truncated,
    stdoutBytes: result.stdoutBytes, streamNotifier, summary, sessionMode: 'none',
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
  const requestId = extra?.requestId !== undefined ? String(extra.requestId) : undefined;

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
