import { buildExecutionEnv } from './ask-command';
import { buildArgArray } from '../../cli-args';
import { executeCommand, registerActiveRequest } from '../../shared';
import type { ExecutionResult } from '../../shared/command-execution/common';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { StreamNotifier } from '../../streaming/common';
import type { AskToolArgs } from '../common';
import { buildCommandOptions, buildNativeSessionArgs, validateAndResolveArgs } from '../utils/ask-command.util';
import { createProviderLiveOutputAdapter } from '../utils/provider-live-output.util';
import { resolveRequestedModel } from '../utils/resolve-requested-model.util';

type RunCommandExecutionInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly extra?: ProgressContext;
  readonly tier2SessionId?: string;
  readonly streamNotifier: StreamNotifier;
};

type CommandExecutionOutcome = {
  readonly result: ExecutionResult;
  readonly outputFormat: ResolvedProviderEntry['config']['outputFormat'];
};

type SpawnCallback = (pid: number) => void;

export const resolveRequestId = (extra?: ProgressContext): string | undefined => {
  if (!extra?.requestId) return;

  const requestId = String(extra.requestId);

  return requestId;
};

const resolveTier2SessionArgs = (config: ResolvedProviderEntry['config'], tier2SessionId?: string): string[] => {
  if (!tier2SessionId) return [];

  const sessionArgs = buildNativeSessionArgs(config, tier2SessionId);

  return sessionArgs;
};

export const buildOnSpawned = (requestId?: string): SpawnCallback | undefined => {
  if (!requestId) return;

  const onSpawned: SpawnCallback = (pid) => registerActiveRequest(requestId, pid);

  return onSpawned;
};

export const runCommandExecution = async (
  runCommandExecutionInput: RunCommandExecutionInput
): Promise<CommandExecutionOutcome> => {
  const { context, args, extra, tier2SessionId, streamNotifier } = runCommandExecutionInput;
  const env = buildExecutionEnv(context);
  const remappedArgs = await resolveRequestedModel({ context, args, env });
  const resolved = validateAndResolveArgs(remappedArgs, context.name);
  const tier2SessionArgs = resolveTier2SessionArgs(context.config, tier2SessionId);
  const { args: cliArgs, stdinInput, outputFormat } = buildArgArray(context.config, resolved, tier2SessionArgs);
  const requestId = resolveRequestId(extra);
  const liveOutputAdapter = createProviderLiveOutputAdapter({
    providerName: context.name,
    outputFormat,
    streamNotifier,
  });

  streamNotifier.emitStart();

  const onSpawned = buildOnSpawned(requestId);
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
    const executionResult: CommandExecutionOutcome = { result, outputFormat };

    return executionResult;
  } finally {
    liveOutputAdapter.flush();
  }
};
