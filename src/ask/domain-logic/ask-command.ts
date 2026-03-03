import type { CommandExecutionErrorDetails, ExecutionResult, ResolvedProviderEntry } from '../../shared';
import {
  CommandExecutionError,
  buildMinimalEnv,
  buildModelHint,
  detectModelError,
  executeCommand,
  extractAttemptedModel,
  fetchAvailableModels,
  resolveProviderEnv,
} from '../../shared';
import type { AskToolArgs } from '../common';

type ExecutionEnv = Readonly<Record<string, string>>;

type ModelHintContext = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  stdout: string;
  stderr: string;
  env: ExecutionEnv;
}>;

export const buildExecutionEnv = (context: ResolvedProviderEntry): ExecutionEnv => {
  const providerEnv = resolveProviderEnv(context);

  return buildMinimalEnv(providerEnv);
};

export const resolveModelHint = async (modelHintContext: ModelHintContext): Promise<string> => {
  const { context, args, stdout, stderr, env } = modelHintContext;

  if (!detectModelError(stdout, stderr)) return '';

  const availableModels = await fetchAvailableModels(context, env, executeCommand);
  const attemptedModel = args.model ?? extractAttemptedModel(stdout, stderr);
  const modelHint = buildModelHint(context.name, attemptedModel, availableModels, Boolean(args.model));

  return modelHint;
};

export const buildCommandFailure = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  env: ExecutionEnv,
  result: ExecutionResult
): Promise<CommandExecutionError> => {
  const details: CommandExecutionErrorDetails = {
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    stderr: result.stderr,
  };
  const modelHintContext: ModelHintContext = { context, args, stdout: result.stdout, stderr: result.stderr, env };
  const suffix = await resolveModelHint(modelHintContext);
  const error = new CommandExecutionError(`${context.name} command failed${suffix}`, details);

  return error;
};
