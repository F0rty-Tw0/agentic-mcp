import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { CommandExecutionError } from '../../common/errors/command-execution.error.ts';
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

const validateAndResolveArgs = (args: AskToolArgs): AskToolArgs => {
  validatePromptSize(args.prompt);

  if (args.model) validateModel(args.model);

  if (args.session_id) validateSessionId(args.session_id);

  const resolvedWorkingDir = args.working_directory ? validateWorkingDirectory(args.working_directory) : '';
  const resolvedFiles = args.files && resolvedWorkingDir ? validateFiles(args.files, resolvedWorkingDir) : [];

  const workingDir = { working_directory: resolvedWorkingDir };
  const files = { files: resolvedFiles };

  const askToolsArgs: AskToolArgs = {
    ...args,
    ...workingDir,
    ...files,
  };

  return askToolsArgs;
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

    if (result.exitCode !== 0) {
      const error = new CommandExecutionError(`${context.name} command failed`, {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        stderr: result.stderr,
      });

      return error.toMcpResponse();
    }

    const output = stripAnsi(result.stdout);

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return toMcpError(error);
  }
};
