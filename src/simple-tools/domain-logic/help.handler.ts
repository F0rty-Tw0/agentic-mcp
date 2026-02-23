import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProviderEntry } from '../../shared/common/index.ts';
import { executeCommand } from '../../shared/domain-logic/command-executor.ts';
import { resolveProviderEnv } from '../../shared/domain-logic/provider-env-resolver.ts';
import { buildMinimalEnv, stripAnsi, toMcpError } from '../../shared/utils/index.ts';

const HELP_TIMEOUT_MS = 10_000;

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

    // Intentional: some CLIs exit non-zero for --help (e.g. exit 1).
    // We still return the output rather than treating it as a failure.
    const output = stripAnsi(result.stdout || result.stderr).trim();

    const helpResponse: CallToolResult = { content: [{ type: 'text', text: output }] };

    return helpResponse;
  } catch (error) {
    return toMcpError(error);
  }
};
