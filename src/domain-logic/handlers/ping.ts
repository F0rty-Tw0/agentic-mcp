import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProviderEntry } from '../../common/provider-config.type.ts';
import { buildMinimalEnv, stripAnsi } from '../../utils/platform.ts';
import { toMcpError } from '../../utils/to-mcp-error.ts';
import { executeCommand } from '../command-executor.ts';

const PING_TIMEOUT_MS = 10_000;

const createPingResponse = (text: string): CallToolResult => {
  const pingResponse: CallToolResult = {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };

  return pingResponse;
};

const resolveVersion = (output: string, pattern?: string): string => {
  if (!pattern) return output;

  const match = new RegExp(pattern).exec(output);

  if (!match?.[1]) return output;

  return match[1];
};

export const handlePing = async (context: ResolvedProviderEntry): Promise<CallToolResult> => {
  try {
    if (!context.config.versionCheck) {
      return createPingResponse(`${context.name}: available (binary: ${context.binaryPath})`);
    }

    const env = buildMinimalEnv(context.config.env);
    const result = await executeCommand({
      binaryPath: context.binaryPath,
      args: [context.config.versionCheck.flag],
      env,
      timeoutMs: PING_TIMEOUT_MS,
    });

    if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
      return createPingResponse(
        `${context.name}: not responding (exit ${result.exitCode}, signal: ${result.signal}, timedOut: ${String(result.timedOut)})`,
      );
    }

    const output = stripAnsi(result.stdout).trim();
    const version = resolveVersion(output, context.config.versionCheck.pattern);

    return createPingResponse(`${context.name}: available (version: ${version})`);
  } catch (error) {
    return toMcpError(error);
  }
};
