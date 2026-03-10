import { buildExecutionEnv } from './ask-command';
import { buildArgArray } from '../../cli-args';
import type { ExecutionResult, ProgressContext, ResolvedProviderEntry } from '../../shared';
import { executeCommand, registerActiveRequest } from '../../shared';
import type { StreamNotifier } from '../../streaming';
import type { AskToolArgs } from '../common';
import { buildCommandOptions, buildNativeSessionArgs, validateAndResolveArgs } from '../utils/ask-command.util';
import { createProviderLiveOutputAdapter } from '../utils/provider-live-output.util';
import { resolveRequestedModel } from '../utils/resolve-requested-model.util';

type RunCommandExecutionInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  extra?: ProgressContext;
  tier2SessionId?: string;
  streamNotifier: StreamNotifier;
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

export const runCommandExecution = async (
  runCommandExecutionInput: RunCommandExecutionInput
): Promise<Readonly<{ result: ExecutionResult; outputFormat: ResolvedProviderEntry['config']['outputFormat'] }>> => {
  const { context, args, extra, tier2SessionId, streamNotifier } = runCommandExecutionInput;
  const env = buildExecutionEnv(context);
  const remappedArgs = await resolveRequestedModel({ context, args, env });
  const resolved = validateAndResolveArgs(remappedArgs, context.name);
  const { args: baseCliArgs, stdinInput, outputFormat } = buildArgArray(context.config, resolved);
  const requestId = resolveRequestId(extra);
  const cliArgs = buildCliArgs(context.config, baseCliArgs, tier2SessionId);
  const liveOutputAdapter = createProviderLiveOutputAdapter({
    providerName: context.name,
    outputFormat,
    streamNotifier,
  });

  streamNotifier.emitStart();

  const onSpawned = requestId ? (pid: number): void => registerActiveRequest(requestId, pid) : undefined;
  const commandOptions = buildCommandOptions({
    context,
    resolved,
    cliArgs,
    stdinInput,
    env,
    onStdoutChunk: liveOutputAdapter.onStdoutChunk,
    onStderrChunk: liveOutputAdapter.onStderrChunk,
    signal: extra?.signal,
    onSpawned,
  });

  try {
    const result = await executeCommand(commandOptions);
    const executionResult = { result, outputFormat };

    return executionResult;
  } finally {
    liveOutputAdapter.flush();
  }
};
