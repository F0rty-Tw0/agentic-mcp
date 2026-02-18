import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { loadConfig } from './config/loader.ts';
import type { ResolvedProvider } from './domain-logic/handlers/meta.ts';
import { registerAllTools } from './domain-logic/tool-registry.ts';
import type { ResolvedProviderEntry } from './domain-logic/tool-registry.ts';
import { resolveCliBinary } from './utils/platform.ts';

export async function createServer(options?: { configPath?: string }): Promise<McpServer> {
  const config = await loadConfig(options);

  const resolvedProviders: ResolvedProviderEntry[] = [];
  const allProviders: ResolvedProvider[] = [];

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    const binaryPath = providerConfig.enabled
      ? await resolveCliBinary(providerConfig.command)
      : null;

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

  const server = new McpServer({
    name: 'agentic-mcp',
    version: '0.1.0',
  });

  registerAllTools(server, resolvedProviders, allProviders);

  return server;
}
