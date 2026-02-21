import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildArgArray } from './arg.builder.ts';
import type { ExecuteCommandOptions } from '../../../shared/common/command-executor.types.ts';
import { CommandExecutionError } from '../../../shared/common/errors/command-execution.error.ts';
import type { CommandExecutionErrorDetails } from '../../../shared/common/errors/command-execution.error.ts';
import { ValidationError } from '../../../shared/common/errors/validation-error.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/provider-config.type.ts';
import { executeCommand } from '../../../shared/domain-logic/command-executor.ts';
import { resolveProviderEnv } from '../../../shared/domain-logic/provider-env-resolver.ts';
import { buildMinimalEnv, stripAnsi } from '../../../shared/utils/platform.util.ts';
import { toMcpError } from '../../../shared/utils/to-mcp-error.util.ts';
import type { ProgressContext } from '../common/progress-context.types.ts';
import type { AskToolArgs } from '../common/tool-args.types.ts';
import { startHeartbeat } from '../utils/heartbeat.util.ts';
import { buildModelHint, detectModelError } from '../utils/model-error.util.ts';
import {
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from '../utils/validation.util.ts';

const MAX_RESPONSE_TEXT_BYTES = 200 * 1024;

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

const buildCommandOptions = (
  context: ResolvedProviderEntry,
  resolved: AskToolArgs,
  cliArgs: readonly string[],
  stdinInput?: string
): ExecuteCommandOptions => {
  const env = buildMinimalEnv(resolveProviderEnv(context));
  const commandOptions: ExecuteCommandOptions = {
    binaryPath: context.binaryPath,
    args: [...cliArgs],
    env,
    timeoutMs: context.config.timeout,
    stdin: stdinInput,
    cwd: resolved.working_directory,
  };

  return commandOptions;
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

    const commandOptions = buildCommandOptions(context, resolved, cliArgs, stdinInput);

    const result = await executeCommand(commandOptions);

    if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
      const details: CommandExecutionErrorDetails = {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        stderr: result.stderr,
      };
      const suffix = detectModelError(result.stdout, result.stderr) ? buildModelHint(context.name) : '';
      const error = new CommandExecutionError(`${context.name} command failed${suffix}`, details);

      return error.toMcpResponse();
    }

    const output = stripAnsi(result.stdout);

    // Some CLIs exit 0 but return an error payload (e.g. model-not-found in JSON output).
    // Detect model errors and surface an actionable hint.
    if (detectModelError(output, result.stderr)) {
      const modelHint = buildModelHint(context.name);
      const response: CallToolResult = {
        isError: true,
        content: [{ type: 'text', text: output + modelHint }],
      };

      return response;
    }

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
