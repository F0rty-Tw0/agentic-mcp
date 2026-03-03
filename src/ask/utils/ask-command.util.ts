import type { ExecuteCommandOptions, FlagValue, ProviderConfig, ResolvedProviderEntry } from '../../shared/common';
import { ValidationError } from '../../shared/common/errors';
import {
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from '../../shared/utils';
import { SESSION_CONTINUE_FLAG_KEY, SESSION_RESUME_FLAG_KEY } from '../common';
import type { AskToolArgs } from '../common';

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
  const workingDir = resolvedWorkingDir ? { working_directory: resolvedWorkingDir } : {};
  const files = resolvedFiles.length ? { files: resolvedFiles } : {};

  const resolvedArgs: AskToolArgs = {
    ...args,
    ...workingDir,
    ...files,
  };

  return resolvedArgs;
};

export const buildCommandOptions = (buildCommandOptionsInput: BuildCommandOptionsInput): ExecuteCommandOptions => {
  const { context, resolved, cliArgs, stdinInput, env, onStdoutChunk, onStderrChunk, signal, onSpawned } =
    buildCommandOptionsInput;

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

const resolveSessionFlagArgs = (flagValue: FlagValue | undefined, value: string): string[] => {
  if (!flagValue) return [];

  if (typeof flagValue === 'string') return [flagValue, value];

  if (Array.isArray(flagValue)) return [...flagValue, value];

  if (!flagValue.values.includes(value)) return [];

  return [flagValue.flag, value];
};

export const buildNativeSessionArgs = (config: ProviderConfig, nativeSessionId: string): string[] => {
  const sessionsCommand = config.commands.sessions;

  if (!sessionsCommand?.flags) return [];

  const resumeFlag = sessionsCommand.flags[SESSION_RESUME_FLAG_KEY];
  const continueFlag = sessionsCommand.flags[SESSION_CONTINUE_FLAG_KEY];

  const resumeArgs = resolveSessionFlagArgs(resumeFlag, nativeSessionId);

  if (resumeArgs.length) return resumeArgs;

  return resolveSessionFlagArgs(continueFlag, nativeSessionId);
};
