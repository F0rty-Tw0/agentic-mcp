import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ResolvedProviderEntry } from './common/provider-config.type.ts';
import { loadConfig } from './config/loader.ts';
import type { ResolvedProvider } from './domain-logic/handlers/meta.ts';
import { registerAllTools } from './domain-logic/tool-registry.ts';
import { resolveCliBinary } from './utils/platform.ts';

export const createServer = async (options?: { configPath?: string }): Promise<McpServer> => {
  const config = await loadConfig(options);

  const resolvedProviders: ResolvedProviderEntry[] = [];
  const allProviders: ResolvedProvider[] = [];

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    const binaryPath = providerConfig.enabled ? await resolveCliBinary(providerConfig.command) : null;

    allProviders.push({
      name,
      description: providerConfig.description,
      enabled: providerConfig.enabled,
      available: binaryPath !== null,
      binaryPath,
    });

    if (providerConfig.enabled && binaryPath) {
      resolvedProviders.push({
        name,
        binaryPath,
        config: providerConfig,
      });
    }
  }

  // __APP_VERSION__ is injected by esbuild `define` at build time; falls back in dev/test.
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';

  const server = new McpServer({
    name: 'agentic-mcp',
    version,
  });

  registerAllTools(server, resolvedProviders, allProviders);

  return server;
};
