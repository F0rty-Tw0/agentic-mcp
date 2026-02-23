import { CommandExecutionError, ValidationError } from '../../../shared/common/index.ts';
import type {
  CommandDef,
  CommandExecutionErrorDetails,
  ExecuteCommandOptions,
  FlagValue,
  ProviderConfig,
  ResolvedProviderEntry,
} from '../../../shared/common/index.ts';
import { executeCommand } from '../../../shared/domain-logic/command-executor.ts';
import { resolveProviderEnv } from '../../../shared/domain-logic/provider-env-resolver.ts';
import {
  buildMinimalEnv,
  buildModelHint,
  detectModelError,
  extractAttemptedModel,
  fetchAvailableModels,
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from '../../../shared/utils/index.ts';
import type { AskToolArgs } from '../common/index.ts';

const MAX_RESPONSE_TEXT_BYTES = 200 * 1024;

const SESSION_RESUME_FLAG_KEY = 'resume';
const SESSION_CONTINUE_FLAG_KEY = 'continue';

type BuildCommandOptionsInput = Readonly<{
  context: ResolvedProviderEntry;
  resolved: AskToolArgs;
  cliArgs: readonly string[];
  stdinInput?: string;
  env: Readonly<Record<string, string>>;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
  signal?: AbortSignal;
  onSpawned?: (pid: number) => void;
}>;

type ModelHintContext = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  stdout: string;
  stderr: string;
  env: Readonly<Record<string, string>>;
}>;

const resolveFilesArg = (files?: readonly string[], workingDir?: string): string[] => {
  if (!files?.length) return [];

  if (!workingDir) {
    throw new ValidationError('working_directory is required when files are specified');
  }

  return validateFiles(files, workingDir);
};

export const validateAndResolveArgs = (args: AskToolArgs): AskToolArgs => {
  validatePromptSize(args.prompt);

  if (args.model) validateModel(args.model);

  if (args.session_id) validateSessionId(args.session_id);

  const resolvedWorkingDir = args.working_directory && validateWorkingDirectory(args.working_directory);
  const resolvedFiles = resolveFilesArg(args.files, resolvedWorkingDir);

  const resolvedArgs: AskToolArgs = {
    ...args,
    ...(resolvedWorkingDir ? { working_directory: resolvedWorkingDir } : {}),
    ...(resolvedFiles.length > 0 ? { files: resolvedFiles } : {}),
  };

  return resolvedArgs;
};

export const buildExecutionEnv = (context: ResolvedProviderEntry): Readonly<Record<string, string>> => {
  return buildMinimalEnv(resolveProviderEnv(context));
};

export const buildCommandOptions = ({
  context,
  resolved,
  cliArgs,
  stdinInput,
  env,
  onStdoutChunk,
  onStderrChunk,
  signal,
  onSpawned,
}: BuildCommandOptionsInput): ExecuteCommandOptions => {
  const commandOptions: ExecuteCommandOptions = {
    binaryPath: context.binaryPath,
    args: [...cliArgs],
    env,
    timeoutMs: context.config.timeout,
    stdin: stdinInput,
    cwd: resolved.working_directory,
    onStdoutChunk,
    onStderrChunk,
    signal,
    onSpawned,
  };

  return commandOptions;
};

const resolveFlagArgs = (flagValue: FlagValue | undefined, value: string): string[] => {
  if (!flagValue) return [];

  if (typeof flagValue === 'string') return [flagValue, value];

  if (Array.isArray(flagValue)) return [...flagValue, value];

  if (!flagValue.values.includes(value)) return [];

  return [flagValue.flag, value];
};

const getSessionsCommand = (config: ProviderConfig): CommandDef | undefined => {
  return config.commands.sessions;
};

export const buildNativeSessionArgs = (config: ProviderConfig, nativeSessionId: string): string[] => {
  const sessionsCommand = getSessionsCommand(config);

  if (!sessionsCommand?.flags) return [];

  const resumeFlag = sessionsCommand.flags[SESSION_RESUME_FLAG_KEY];
  const continueFlag = sessionsCommand.flags[SESSION_CONTINUE_FLAG_KEY];

  const resumeArgs = resolveFlagArgs(resumeFlag, nativeSessionId);

  if (resumeArgs.length > 0) return resumeArgs;

  return resolveFlagArgs(continueFlag, nativeSessionId);
};

export const resolveModelHint = async ({ context, args, stdout, stderr, env }: ModelHintContext): Promise<string> => {
  if (!detectModelError(stdout, stderr)) return '';

  const availableModels = await fetchAvailableModels(context, env, executeCommand);
  const attemptedModel = args.model ?? extractAttemptedModel(stdout, stderr);

  return buildModelHint(context.name, attemptedModel, availableModels, Boolean(args.model));
};

export const buildCappedOutput = (output: string): string => {
  const outputBytes = Buffer.byteLength(output, 'utf8');

  if (outputBytes <= MAX_RESPONSE_TEXT_BYTES) return output;

  return `${Buffer.from(output, 'utf8').subarray(0, MAX_RESPONSE_TEXT_BYTES).toString('utf8')}\n\n[output truncated — ${outputBytes} bytes total]`;
};

export const buildCommandFailure = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  env: Readonly<Record<string, string>>,
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
