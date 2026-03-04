import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProviderEntry } from '../../shared';
import { buildMinimalEnv, executeCommand, resolveProviderEnv, stripAnsi, toMcpError } from '../../shared';

const HELP_TIMEOUT_MS = 30_000;

export const handleHelp = async (context: ResolvedProviderEntry): Promise<CallToolResult> => {
  try {
    const providerEnv = resolveProviderEnv(context);
    const env = buildMinimalEnv(providerEnv);
    const result = await executeCommand({
      binaryPath: context.binaryPath,
      args: ['--help'],
      env,
      timeoutMs: HELP_TIMEOUT_MS,
      bypassSemaphore: true,
    });

    if (result.timedOut) {
      const helpTimeout: CallToolResult = {
        content: [{ type: 'text', text: `${context.name}: help timed out after ${HELP_TIMEOUT_MS}ms` }],
        isError: true,
      };

      return helpTimeout;
    }

    // Intentional: some CLIs exit non-zero for --help (e.g. exit 1).
    // We still return the output rather than treating it as a failure.
    const output = stripAnsi(result.stdout || result.stderr).trim();

    if (!output) {
      const helpEmpty: CallToolResult = {
        content: [
          {
            type: 'text',
            text: `${context.name}: no help output (exit ${result.exitCode}, signal: ${result.signal})`,
          },
        ],
        isError: true,
      };

      return helpEmpty;
    }

    const helpResponse: CallToolResult = { content: [{ type: 'text', text: output }] };

    return helpResponse;
  } catch (error) {
    return toMcpError(error);
  }
};
