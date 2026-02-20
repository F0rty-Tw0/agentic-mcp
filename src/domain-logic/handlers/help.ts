import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProviderEntry } from '../../common/provider-config.type.ts';
import { buildMinimalEnv, stripAnsi } from '../../utils/platform.ts';
import { toMcpError } from '../../utils/to-mcp-error.ts';
import { executeCommand } from '../command-executor.ts';

const HELP_TIMEOUT_MS = 10_000;

export const handleHelp = async (context: ResolvedProviderEntry): Promise<CallToolResult> => {
  try {
    const env = buildMinimalEnv(context.config.env);
    const result = await executeCommand({
      binaryPath: context.binaryPath,
      args: ['--help'],
      env,
      timeoutMs: HELP_TIMEOUT_MS,
    });

    // Intentional: some CLIs exit non-zero for --help (e.g. exit 1).
    // We still return the output rather than treating it as a failure.
    const output = stripAnsi(result.stdout || result.stderr).trim();

    const helpResponse: CallToolResult = { content: [{ type: 'text', text: output }] };

    return helpResponse;
  } catch (error) {
    return toMcpError(error);
  }
};
