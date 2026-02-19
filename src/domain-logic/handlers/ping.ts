import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProviderEntry } from '../../common/provider-config.type.ts';
import { buildMinimalEnv, stripAnsi } from '../../utils/platform.ts';
import { toMcpError } from '../../utils/to-mcp-error.ts';
import { executeCommand } from '../command-executor.ts';

const PING_TIMEOUT_MS = 10_000;

export const handlePing = async (context: ResolvedProviderEntry): Promise<CallToolResult> => {
  try {
    if (!context.config.versionCheck) {
      const versionCheckResponse: CallToolResult = {
        content: [
          {
            type: 'text',
            text: `${context.name}: available (binary: ${context.binaryPath})`,
          },
        ],
      };

      return versionCheckResponse;
    }

    const env = buildMinimalEnv(context.config.env);
    const result = await executeCommand({
      binaryPath: context.binaryPath,
      args: [context.config.versionCheck.flag],
      env,
      timeoutMs: PING_TIMEOUT_MS,
    });

    const output = stripAnsi(result.stdout).trim();
    let version = output;

    if (context.config.versionCheck.pattern) {
      const match = new RegExp(context.config.versionCheck.pattern).exec(output);

      if (match?.[1]) {
        version = match[1];
      }
    }

    const versionCheckResponse: CallToolResult = {
      content: [
        {
          type: 'text',
          text: `${context.name}: available (version: ${version})`,
        },
      ],
    };

    return versionCheckResponse;
  } catch (error) {
    return toMcpError(error);
  }
};
