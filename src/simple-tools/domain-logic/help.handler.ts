import type { CallToolResult } from '@modelcontextprotocol/server';

import {
  buildMinimalEnv,
  buildProbeQueueOptions,
  executeCommand,
  resolveProviderEnv,
  stripAnsi,
  toMcpError,
} from '../../shared';
import type { ResolvedProviderEntry } from '../../shared/provider/common';

const HELP_TIMEOUT_MS = 30_000;

export const handleHelp = async (context: ResolvedProviderEntry, signal?: AbortSignal): Promise<CallToolResult> => {
  try {
    const providerEnv = resolveProviderEnv(context);
    const env = buildMinimalEnv(providerEnv);
    const providerQueue = buildProbeQueueOptions(context);
    const result = await executeCommand({
      binaryPath: context.binaryPath,
      args: ['--help'],
      env,
      timeoutMs: HELP_TIMEOUT_MS,
      providerQueue,
      signal,
    });

    if (result.timedOut) {
      const content: CallToolResult['content'] = [
        { type: 'text', text: `${context.name}: help timed out after ${HELP_TIMEOUT_MS}ms` },
      ];
      const helpTimeout: CallToolResult = {
        content,
        isError: true,
      };

      return helpTimeout;
    }

    // Intentional: some CLIs exit non-zero for --help (e.g. exit 1).
    // We still return the output rather than treating it as a failure.
    const output = stripAnsi(result.stdout || result.stderr).trim();

    if (!output) {
      const content: CallToolResult['content'] = [
        {
          type: 'text',
          text: `${context.name}: no help output (exit ${result.exitCode}, signal: ${result.signal})`,
        },
      ];
      const helpEmpty: CallToolResult = {
        content,
        isError: true,
      };

      return helpEmpty;
    }

    const content: CallToolResult['content'] = [{ type: 'text', text: output }];
    const helpResponse: CallToolResult = { content };

    return helpResponse;
  } catch (error) {
    return toMcpError(error);
  }
};
