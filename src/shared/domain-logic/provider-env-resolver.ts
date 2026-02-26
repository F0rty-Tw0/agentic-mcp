import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../common';
import type { ProviderEnv, ResolvedProviderEntry } from '../common';

const MCP_TOOL_TIMEOUT_ENV_KEY = 'MCP_TOOL_TIMEOUT';

const withDefaultMcpToolTimeout = (providerEnv: ProviderEnv): ProviderEnv => {
  if (providerEnv[MCP_TOOL_TIMEOUT_ENV_KEY] != null) {
    return providerEnv;
  }

  const resolvedProviderEnv: ProviderEnv = {
    ...providerEnv,
    [MCP_TOOL_TIMEOUT_ENV_KEY]: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
  };

  return resolvedProviderEnv;
};

export const resolveProviderEnv = (context: ResolvedProviderEntry): Readonly<ProviderEnv> => {
  const resolvedProviderEnv = withDefaultMcpToolTimeout(context.config.env);

  return resolvedProviderEnv;
};
