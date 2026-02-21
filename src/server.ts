import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { loadConfig } from './config/loader.ts';
import { registerAllTools } from './feature/tool-registry/tool-registry.ts';
import type { ResolvedProvider, ResolvedProviderEntry } from './shared/common/provider-config.type.ts';
import { resolveCliBinary } from './shared/utils/platform.util.ts';

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

  if (resolvedProviders.length === 0) {
    process.stderr.write(
      'Warning: no providers are available. Install at least one CLI tool (claude, codex, copilot, gemini, opencode) and restart.\n',
    );
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
