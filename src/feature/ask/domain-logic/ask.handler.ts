import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildArgArray } from './arg.builder.ts';
import { CommandExecutionError, ValidationError } from '../../../shared/common/index.ts';
import type {
  CommandExecutionErrorDetails,
  ExecuteCommandOptions,
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
  startHeartbeat,
  stripAnsi,
  toMcpError,
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from '../../../shared/utils/index.ts';
import type { AskToolArgs, ProgressContext } from '../common/index.ts';

const MAX_RESPONSE_TEXT_BYTES = 200 * 1024;

type CommandOptionExtras = Readonly<{
  stdinInput?: string;
  env?: Readonly<Record<string, string>>;
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

const validateAndResolveArgs = (args: AskToolArgs): AskToolArgs => {
  validatePromptSize(args.prompt);

  if (args.model) validateModel(args.model);

  if (args.session_id) validateSessionId(args.session_id);

  const resolvedWorkingDir = args.working_directory && validateWorkingDirectory(args.working_directory);
  const resolvedFiles = resolveFilesArg(args.files, resolvedWorkingDir);
  const workingDirectoryInfo = resolvedWorkingDir ? { working_directory: resolvedWorkingDir } : {};
  const filesPayload = resolvedFiles.length ? { files: resolvedFiles } : {};

  const resolvedArgs: AskToolArgs = {
    ...args,
    ...workingDirectoryInfo,
    ...filesPayload,
  };

  return resolvedArgs;
};

const buildCommandOptions = (
  context: ResolvedProviderEntry,
  resolved: AskToolArgs,
  cliArgs: readonly string[],
  extras?: CommandOptionExtras
): ExecuteCommandOptions => {
  const resolvedEnv = extras?.env ?? buildMinimalEnv(resolveProviderEnv(context));
  const commandOptions: ExecuteCommandOptions = {
    binaryPath: context.binaryPath,
    args: [...cliArgs],
    env: resolvedEnv,
    timeoutMs: context.config.timeout,
    stdin: extras?.stdinInput,
    cwd: resolved.working_directory,
  };

  return commandOptions;
};

const resolveModelHint = async ({ context, args, stdout, stderr, env }: ModelHintContext): Promise<string> => {
  if (!detectModelError(stdout, stderr)) return '';

  const availableModels = await fetchAvailableModels(context, env, executeCommand);
  const attemptedModel = args.model ?? extractAttemptedModel(stdout, stderr);
  const modelHint = buildModelHint(context.name, attemptedModel, availableModels, Boolean(args.model));

  return modelHint;
};

const buildCappedOutput = (output: string): string => {
  const outputBytes = Buffer.byteLength(output, 'utf8');

  if (outputBytes <= MAX_RESPONSE_TEXT_BYTES) return output;

  const formattedOutput = `${Buffer.from(output, 'utf8').subarray(0, MAX_RESPONSE_TEXT_BYTES).toString('utf8')}\n\n[output truncated — ${outputBytes} bytes total]`;

  return formattedOutput;
};

export const handleAsk = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  extra?: ProgressContext
): Promise<CallToolResult> => {
  const stopHeartbeat = startHeartbeat(extra);

  try {
    const resolved = validateAndResolveArgs(args);

    const { args: cliArgs, stdinInput } = buildArgArray(context.config, resolved);

    const env = buildMinimalEnv(resolveProviderEnv(context));
    const commandOptions = buildCommandOptions(context, resolved, cliArgs, { stdinInput, env });

    const result = await executeCommand(commandOptions);

    if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
      const details: CommandExecutionErrorDetails = {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        stderr: result.stderr,
      };

      const suffix = await resolveModelHint({ context, args, stdout: result.stdout, stderr: result.stderr, env });

      const error = new CommandExecutionError(`${context.name} command failed${suffix}`, details);

      return error.toMcpResponse();
    }

    const output = stripAnsi(result.stdout);

    const modelHint = await resolveModelHint({ context, args, stdout: output, stderr: result.stderr, env });

    if (modelHint) {
      const response: CallToolResult = {
        isError: true,
        content: [{ type: 'text', text: output + modelHint }],
      };

      return response;
    }

    const cappedOutput = buildCappedOutput(output);

    const response: CallToolResult = {
      content: [{ type: 'text', text: cappedOutput.length > 0 ? cappedOutput : '(no output)' }],
    };

    return response;
  } catch (error) {
    return toMcpError(error);
  } finally {
    stopHeartbeat();
  }
};
