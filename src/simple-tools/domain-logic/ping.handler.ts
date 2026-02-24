import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProviderEntry } from "../../shared/common";
import { executeCommand } from '../../shared/domain-logic/command-executor';
import { resolveProviderEnv } from '../../shared/domain-logic/provider-env-resolver';
import { buildMinimalEnv, stripAnsi, toMcpError } from "../../shared/utils";

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

    const providerEnv = resolveProviderEnv(context);
    const env = buildMinimalEnv(providerEnv);
    const result = await executeCommand({
      binaryPath: context.binaryPath,
      args: [context.config.versionCheck.flag],
      env,
      timeoutMs: PING_TIMEOUT_MS,
      bypassSemaphore: true,
    });

    if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
      return createPingResponse(
        `${context.name}: not responding (exit ${result.exitCode}, signal: ${result.signal}, timedOut: ${String(result.timedOut)})`
      );
    }

    const output = stripAnsi(result.stdout).trim();
    const version = resolveVersion(output, context.config.versionCheck.pattern);

    return createPingResponse(`${context.name}: available (version: ${version})`);
  } catch (error) {
    return toMcpError(error);
  }
};
