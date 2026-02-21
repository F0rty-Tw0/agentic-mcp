import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../common/execution-limits.const.ts';
import type { ResolvedProviderEntry } from '../common/provider-config.type.ts';

const MCP_TOOL_TIMEOUT_ENV_KEY = 'MCP_TOOL_TIMEOUT';

const withDefaultMcpToolTimeout = (providerEnv: Record<string, string | null>): Record<string, string | null> => {
  if (providerEnv[MCP_TOOL_TIMEOUT_ENV_KEY] != null) {
    return providerEnv;
  }

  const resolvedProviderEnv: Record<string, string | null> = {
    ...providerEnv,
    [MCP_TOOL_TIMEOUT_ENV_KEY]: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
  };

  return resolvedProviderEnv;
};

export const resolveProviderEnv = (context: ResolvedProviderEntry): Readonly<Record<string, string | null>> => {
  const resolvedProviderEnv = withDefaultMcpToolTimeout(context.config.env);

  return resolvedProviderEnv;
};
