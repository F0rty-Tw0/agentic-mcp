import { buildExecutionEnv } from './ask-command';
import { buildArgArray } from '../../cli-args';
import { executeCommand } from '../../shared';
import type { ExecutionResult } from '../../shared/command-execution/common';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { StreamNotifier } from '../../streaming/common';
import type { AskToolArgs } from '../common';
import { buildCommandOptions, validateAndResolveArgs } from '../utils/ask-command.util';
import { createProviderLiveOutputAdapter } from '../utils/provider-live-output.util';
import { resolveRequestedModel } from '../utils/resolve-requested-model.util';
import { buildNativeSessionArgs, buildStartSessionArgs } from '../utils/session-flag-args.util';

type RunCommandExecutionInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly extra?: ProgressContext;
  readonly tier2SessionId?: string;
  readonly startSessionId?: string;
  readonly streamNotifier: StreamNotifier;
};

type CommandExecutionOutcome = {
  readonly result: ExecutionResult;
  readonly outputFormat: ResolvedProviderEntry['config']['outputFormat'];
};

const resolveSessionArgs = (runCommandExecutionInput: RunCommandExecutionInput): string[] => {
  const { context, tier2SessionId, startSessionId } = runCommandExecutionInput;

  if (tier2SessionId) return buildNativeSessionArgs(context.config, tier2SessionId);

  if (startSessionId) return buildStartSessionArgs(context.config, startSessionId);

  return [];
};

export const runCommandExecution = async (
  runCommandExecutionInput: RunCommandExecutionInput
): Promise<CommandExecutionOutcome> => {
  const { context, args, extra, streamNotifier } = runCommandExecutionInput;
  const env = buildExecutionEnv(context);
  const remappedArgs = await resolveRequestedModel({ context, args, env });
  const resolved = validateAndResolveArgs(remappedArgs, context.name);
  const sessionArgs = resolveSessionArgs(runCommandExecutionInput);
  const { args: cliArgs, stdinInput, outputFormat } = buildArgArray(context.config, resolved, sessionArgs);
  const liveOutputAdapter = createProviderLiveOutputAdapter({
    providerName: context.name,
    outputFormat,
    streamNotifier,
  });

  streamNotifier.emitStart();

  const commandOptions = buildCommandOptions({
    context,
    resolved,
    cliArgs,
    stdinInput,
    env,
    onStdoutChunk: liveOutputAdapter.onStdoutChunk,
    onStderrChunk: liveOutputAdapter.onStderrChunk,
    signal: extra?.signal,
    outputFormat,
  });

  try {
    const result = await executeCommand(commandOptions);
    const executionResult: CommandExecutionOutcome = { result, outputFormat };

    return executionResult;
  } finally {
    liveOutputAdapter.flush();
  }
};
