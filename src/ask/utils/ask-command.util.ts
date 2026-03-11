import type { ExecuteCommandOptions, FlagValue, ProviderConfig, ResolvedProviderEntry } from '../../shared';
import {
  DEFAULT_MCP_TOOL_TIMEOUT_MS,
  ValidationError,
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from '../../shared';
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

const COPILOT_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'codex 5.3': 'gpt-5.3-codex',
};

const resolveModelAlias = (providerName: string | undefined, model: string | undefined): string | undefined => {
  if (model == null) return model;

  if (providerName !== 'copilot') return model;

  return COPILOT_MODEL_ALIASES[model.toLowerCase()] ?? model;
};

const resolveFilesArg = (files?: readonly string[], workingDir?: string): string[] => {
  if (!files?.length) return [];

  if (!workingDir) {
    throw new ValidationError('working_directory is required when files are specified');
  }

  return validateFiles(files, workingDir);
};

export const resolveAskTimeoutMs = (providerTimeoutMs: number): number => {
  const resolvedTimeoutMs = providerTimeoutMs || DEFAULT_MCP_TOOL_TIMEOUT_MS;

  return resolvedTimeoutMs;
};

export const validateAndResolveArgs = (args: AskToolArgs, providerName?: string): AskToolArgs => {
  const model = resolveModelAlias(providerName, args.model);

  validatePromptSize(args.prompt);

  if (model) validateModel(model);

  if (args.session_id) validateSessionId(args.session_id);

  const resolvedWorkingDir = args.working_directory && validateWorkingDirectory(args.working_directory);
  const resolvedFiles = resolveFilesArg(args.files, resolvedWorkingDir);
  const workingDir = resolvedWorkingDir ? { working_directory: resolvedWorkingDir } : {};
  const files = resolvedFiles.length ? { files: resolvedFiles } : {};

  const resolvedArgs: AskToolArgs = {
    ...args,
    ...(model ? { model } : {}),
    ...workingDir,
    ...files,
  };

  return resolvedArgs;
};

export const buildCommandOptions = (buildCommandOptionsInput: BuildCommandOptionsInput): ExecuteCommandOptions => {
  const { context, resolved, cliArgs, stdinInput, env, onStdoutChunk, onStderrChunk, signal, onSpawned } =
    buildCommandOptionsInput;

  const timeoutMs = resolveAskTimeoutMs(context.config.timeout);
  const commandOptions: ExecuteCommandOptions = {
    binaryPath: context.binaryPath,
    args: [...cliArgs],
    env,
    timeoutMs,
    idleTimeoutMs: context.config.idleTimeout,
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
