import { createResultEnvelopeDetector } from './complete-result.util';
import {
  DEFAULT_MCP_TOOL_TIMEOUT_MS,
  ValidationError,
  buildProviderQueueOptions,
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from '../../shared';
import type { ExecuteCommandOptions, ResultCompleteDetector } from '../../shared/command-execution/common';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import type { FlagValue, ProviderConfig, ResolvedProviderEntry } from '../../shared/provider/common';
import { SESSION_CONTINUE_FLAG_KEY, SESSION_RESUME_FLAG_KEY } from '../common';
import type { AskToolArgs } from '../common';

type BuildCommandOptionsInput = {
  readonly context: ResolvedProviderEntry;
  readonly resolved: AskToolArgs;
  readonly cliArgs: string[];
  readonly stdinInput?: string;
  readonly env: Readonly<Record<string, string>>;
  readonly onStdoutChunk?: (chunk: string) => void;
  readonly onStderrChunk?: (chunk: string) => void;
  readonly signal?: AbortSignal;
  readonly outputFormat?: OutputFormat;
};

const COPILOT_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'codex 5.3': 'gpt-5.3-codex',
};

const resolveModelAlias = (providerName: string | undefined, model: string | undefined): string | undefined => {
  if (model == null) return model;

  if (providerName !== 'copilot') return model;

  return COPILOT_MODEL_ALIASES[model.toLowerCase()] ?? model;
};

const resolveFilesArg = (files?: string[], workingDir?: string): string[] => {
  if (!files?.length) return [];

  if (!workingDir) throw new ValidationError('working_directory is required when files are specified');

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
  const noArgs: AskToolArgs = {};
  const modelArgs: AskToolArgs = { model };
  const workingDirectoryArgs: AskToolArgs = { working_directory: resolvedWorkingDir };
  const filesArgs: AskToolArgs = { files: resolvedFiles };
  const modelPatch = model ? modelArgs : noArgs;
  const workingDir = resolvedWorkingDir ? workingDirectoryArgs : noArgs;
  const files = resolvedFiles.length ? filesArgs : noArgs;

  const resolvedArgs: AskToolArgs = {
    ...args,
    ...modelPatch,
    ...workingDir,
    ...files,
  };

  return resolvedArgs;
};

const resolveResultDetector = (
  config: ProviderConfig,
  outputFormat?: OutputFormat
): ResultCompleteDetector | undefined => {
  if (!config.acceptResultOnTimeout || outputFormat === undefined) return;

  const isResultComplete = createResultEnvelopeDetector(outputFormat);

  return isResultComplete;
};

export const buildCommandOptions = (buildCommandOptionsInput: BuildCommandOptionsInput): ExecuteCommandOptions => {
  const { context, resolved, cliArgs, stdinInput, env, onStdoutChunk, onStderrChunk, signal } =
    buildCommandOptionsInput;
  const isResultComplete = resolveResultDetector(context.config, buildCommandOptionsInput.outputFormat);

  const timeoutMs = resolveAskTimeoutMs(context.config.timeout);
  const providerQueue = buildProviderQueueOptions(context);
  const commandOptions: ExecuteCommandOptions = {
    binaryPath: context.binaryPath,
    args: [...cliArgs],
    env,
    timeoutMs,
    idleTimeoutMs: context.config.idleTimeout,
    stdin: stdinInput,
    cwd: resolved.working_directory,
    providerQueue,
    onStdoutChunk,
    onStderrChunk,
    signal,
    isResultComplete,
    resultExitGraceMs: context.config.resultExitGraceMs,
  };

  return commandOptions;
};

const resolveSessionFlagArgs = (flagValue: FlagValue | undefined, value: string): string[] => {
  if (!flagValue) return [];

  if (typeof flagValue === 'string') return [flagValue, value];

  if (Array.isArray(flagValue)) return [...flagValue, value];

  const isAllowedValue = flagValue.values.includes(value);

  if (!isAllowedValue) return [];

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
