import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../common';
import type { ProviderEnv, ResolvedProviderEntry } from '../common';

const MCP_TOOL_TIMEOUT_ENV_KEY = 'MCP_TOOL_TIMEOUT';

const withDefaultMcpToolTimeout = (providerEnv: ProviderEnv): ProviderEnv => {
  if (providerEnv[MCP_TOOL_TIMEOUT_ENV_KEY] != null) return providerEnv;

  const resolvedProviderEnv: ProviderEnv = {
    ...providerEnv,
    [MCP_TOOL_TIMEOUT_ENV_KEY]: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
  };

  return resolvedProviderEnv;
};

// API keys stay out of the child env unless the provider config names them.
const pickPassthroughEnv = (keys: string[]): ProviderEnv => {
  const passthroughEnv: Record<string, string> = {};

  for (const key of keys) {
    const value = process.env[key];

    if (value !== undefined) passthroughEnv[key] = value;
  }

  return passthroughEnv;
};

export const resolveProviderEnv = (context: ResolvedProviderEntry): Readonly<ProviderEnv> => {
  const passthroughEnv = pickPassthroughEnv(context.config.envPassthrough ?? []);
  const configuredEnv: ProviderEnv = { ...passthroughEnv, ...context.config.env };
  const resolvedProviderEnv = withDefaultMcpToolTimeout(configuredEnv);

  return resolvedProviderEnv;
};
