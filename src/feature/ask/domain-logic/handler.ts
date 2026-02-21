import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildArgArray } from './arg-builder.ts';
import type { ExecuteCommandOptions } from '../../../shared/common/command-executor.types.ts';
import { CommandExecutionError } from '../../../shared/common/errors/command-execution.error.ts';
import type { CommandExecutionErrorDetails } from '../../../shared/common/errors/command-execution.error.ts';
import { ValidationError } from '../../../shared/common/errors/validation-error.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/provider-config.type.ts';
import { executeCommand } from '../../../shared/domain-logic/command-executor.ts';
import { buildMinimalEnv, stripAnsi } from '../../../shared/utils/platform.ts';
import { toMcpError } from '../../../shared/utils/to-mcp-error.ts';
import type { ProgressContext } from '../common/progress-context.types.ts';
import type { AskToolArgs } from '../common/tool-args.types.ts';
import {
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from '../utils/validation.ts';

const MAX_RESPONSE_TEXT_BYTES = 200 * 1024;
const HEARTBEAT_INTERVAL_MS = 30_000;

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

  const resolvedWorkingDir = args.working_directory ? validateWorkingDirectory(args.working_directory) : undefined;
  const resolvedFiles = resolveFilesArg(args.files, resolvedWorkingDir);

  const resolvedArgs: AskToolArgs = {
    ...args,
    ...(resolvedWorkingDir ? { working_directory: resolvedWorkingDir } : {}),
    ...(resolvedFiles.length > 0 ? { files: resolvedFiles } : {}),
  };

  return resolvedArgs;
};

const startHeartbeat = (extra?: ProgressContext): (() => void) => {
  // eslint-disable-next-line no-underscore-dangle
  const progressToken = extra?._meta?.progressToken;

  if (progressToken == null || !extra?.sendNotification) {
    return () => {
      /* empty */
    };
  }

  let progress = 0;

  const timer = setInterval(() => {
    progress++;

    const message = `Processing… (${progress * (HEARTBEAT_INTERVAL_MS / 1000)}s elapsed)`;
    const params = {
      progressToken,
      progress,
      message,
    };

    extra
      .sendNotification({
        method: 'notifications/progress',
        params,
      })
      .catch(() => {
        /* notification failures are non-fatal */
      });
  }, HEARTBEAT_INTERVAL_MS);

  return () => clearInterval(timer);
};

export const handleAsk = async (
  context: ResolvedProviderEntry,
  args: AskToolArgs,
  extra?: ProgressContext,
): Promise<CallToolResult> => {
  const stopHeartbeat = startHeartbeat(extra);

  try {
    const resolved = validateAndResolveArgs(args);

    const { args: cliArgs, stdinInput } = buildArgArray(context.config, resolved);

    const env = buildMinimalEnv(context.config.env);
    const commandOptions: ExecuteCommandOptions = {
      binaryPath: context.binaryPath,
      args: cliArgs,
      env,
      timeoutMs: context.config.timeout,
      stdin: stdinInput,
      cwd: resolved.working_directory,
    };

    const result = await executeCommand(commandOptions);

    if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
      const details: CommandExecutionErrorDetails = {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        stderr: result.stderr,
      };
      const error = new CommandExecutionError(`${context.name} command failed`, details);

      return error.toMcpResponse();
    }

    const output = stripAnsi(result.stdout);

    const outputBytes = Buffer.byteLength(output, 'utf8');
    const formattedOutput = `${Buffer.from(output, 'utf8').subarray(0, MAX_RESPONSE_TEXT_BYTES).toString('utf8')}\n\n[output truncated — ${outputBytes} bytes total]`;
    const cappedOutput = outputBytes > MAX_RESPONSE_TEXT_BYTES ? formattedOutput : output;

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
