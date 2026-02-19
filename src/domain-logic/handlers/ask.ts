import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { CommandExecutionError } from '../../common/errors/command-execution.error.ts';
import { toMcpError } from '../../common/errors/to-mcp-error.ts';
import type { ProviderConfig } from '../../common/provider-config.types.ts';
import { buildMinimalEnv, stripAnsi } from '../../utils/platform.ts';
import {
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from '../../utils/validation.ts';
import { buildArgArray } from '../arg-builder.ts';
import { executeCommand } from '../command-executor.ts';

type AskHandlerContext = {
  binaryPath: string;
  config: ProviderConfig;
  providerName: string;
};

const validateAndResolveArgs = (args: Record<string, unknown>): Record<string, unknown> => {
  validatePromptSize(args.prompt as string);

  const model = args.model as string | undefined;

  if (model) validateModel(model);

  const sessionId = args.session_id as string | undefined;

  if (sessionId) validateSessionId(sessionId);

  const workingDir = args.working_directory as string | undefined;
  const resolvedWorkingDir = workingDir ? validateWorkingDirectory(workingDir) : undefined;

  const files = args.files as string[] | undefined;
  const resolvedFiles = files && resolvedWorkingDir ? validateFiles(files, resolvedWorkingDir) : undefined;

  const resolved = { ...args };

  if (resolvedWorkingDir) resolved.working_directory = resolvedWorkingDir;

  if (resolvedFiles) resolved.files = resolvedFiles;

  return resolved;
};

export const handleAsk = async (context: AskHandlerContext, args: Record<string, unknown>): Promise<CallToolResult> => {
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
      cwd: resolved.working_directory as string | undefined,
    });

    if (result.exitCode !== 0) {
      const error = new CommandExecutionError(`${context.providerName} command failed`, {
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
