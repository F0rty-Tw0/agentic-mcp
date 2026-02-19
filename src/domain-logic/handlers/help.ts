import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { toMcpError } from '../../common/errors/to-mcp-error.ts';
import type { ResolvedProviderEntry } from '../../common/provider-config.type.ts';
import { buildMinimalEnv, stripAnsi } from '../../utils/platform.ts';
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

    // Some CLIs write help to stderr instead of stdout
    const output = stripAnsi(result.stdout || result.stderr).trim();

    const helpResponse: CallToolResult = { content: [{ type: 'text', text: output }] };

    return helpResponse;
  } catch (error) {
    return toMcpError(error);
  }
};
