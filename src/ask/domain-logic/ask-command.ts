import type { CommandExecutionErrorDetails, ResolvedProviderEntry } from '../../shared';
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
  return buildMinimalEnv(resolveProviderEnv(context));
};

export const resolveModelHint = async ({ context, args, stdout, stderr, env }: ModelHintContext): Promise<string> => {
  if (!detectModelError(stdout, stderr)) return '';

  const availableModels = await fetchAvailableModels(context, env, executeCommand);
  const attemptedModel = args.model ?? extractAttemptedModel(stdout, stderr);

  return buildModelHint(context.name, attemptedModel, availableModels, Boolean(args.model));
};

export const buildCommandFailure = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  env: ExecutionEnv,
  result: Readonly<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
  }>
): Promise<CommandExecutionError> => {
  const details: CommandExecutionErrorDetails = {
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    stderr: result.stderr,
  };

  const suffix = await resolveModelHint({ context, args, stdout: result.stdout, stderr: result.stderr, env });

  return new CommandExecutionError(`${context.name} command failed${suffix}`, details);
};
