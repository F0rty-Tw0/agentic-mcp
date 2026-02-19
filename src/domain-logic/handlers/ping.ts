import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { toMcpError } from '../../common/errors/to-mcp-error.ts';
import type { ProviderConfig } from '../../common/provider-config.types.ts';
import { buildMinimalEnv, stripAnsi } from '../../utils/platform.ts';
import { executeCommand } from '../command-executor.ts';

const PING_TIMEOUT_MS = 10_000;

type PingHandlerContext = {
  binaryPath: string;
  config: ProviderConfig;
  providerName: string;
};

export const handlePing = async (context: PingHandlerContext): Promise<CallToolResult> => {
  try {
    if (context.config.versionCheck) {
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

      return {
        content: [
          {
            type: 'text',
            text: `${context.providerName}: available (version: ${version})`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `${context.providerName}: available (binary: ${context.binaryPath})`,
        },
      ],
    };
  } catch (error) {
    return toMcpError(error);
  }
};
