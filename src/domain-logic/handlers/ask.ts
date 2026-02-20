import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { CommandExecutionError } from '../../common/errors/command-execution.error.ts';
import { ValidationError } from '../../common/errors/validation-error.ts';
import type { ResolvedProviderEntry } from '../../common/provider-config.type.ts';
import type { AskToolArgs } from '../../common/tool-args.types.ts';
import { buildMinimalEnv, stripAnsi } from '../../utils/platform.ts';
import { toMcpError } from '../../utils/to-mcp-error.ts';
import {
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from '../../utils/validation.ts';
import { buildArgArray } from '../arg-builder.ts';
import { executeCommand } from '../command-executor.ts';

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

export const handleAsk = async (context: ResolvedProviderEntry, args: AskToolArgs): Promise<CallToolResult> => {
  try {
    const resolved = validateAndResolveArgs(args);

    const { args: cliArgs, stdinInput } = buildArgArray(context.config, resolved);

    const env = buildMinimalEnv(context.config.env);
    const result = await executeCommand({
      binaryPath: context.binaryPath,
      args: cliArgs,
      env,
      timeoutMs: context.config.timeout,
      stdin: stdinInput,
      cwd: resolved.working_directory,
    });

    if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
      const error = new CommandExecutionError(`${context.name} command failed`, {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        stderr: result.stderr,
      });

      return error.toMcpResponse();
    }

    const output = stripAnsi(result.stdout);

    const response: CallToolResult = { content: [{ type: 'text', text: output }] };

    return response;
  } catch (error) {
    return toMcpError(error);
  }
};
