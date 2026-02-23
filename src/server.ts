import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CancelledNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config/loader.ts';
import { registerAllTools } from './feature/tool-registry/tool-registry.ts';
import type { ConfigPathOptions, ResolvedProvider, ResolvedProviderEntry } from './shared/common/index.ts';
import { getActiveRequest, unregisterActiveRequest } from './shared/domain-logic/request-registry.ts';
import { killProcess, resolveCliBinary } from './shared/utils/index.ts';

const toRequestIdString = (requestId?: string | number): string | undefined => {
  if (!requestId) return;

  return String(requestId);
};

export const createServer = async (options?: ConfigPathOptions): Promise<McpServer> => {
  const config = await loadConfig(options);

  const resolvedProviders: ResolvedProviderEntry[] = [];
  const allProviders: ResolvedProvider[] = [];

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    const binaryPath = providerConfig.enabled ? await resolveCliBinary(providerConfig.command) : null;

    const provider: ResolvedProvider = {
      name,
      description: providerConfig.description,
      enabled: providerConfig.enabled,
      available: binaryPath !== null,
      binaryPath,
    };

    allProviders.push(provider);

    if (providerConfig.enabled && binaryPath) {
      const resolvedProvider: ResolvedProviderEntry = {
        name,
        binaryPath,
        config: providerConfig,
      };

      resolvedProviders.push(resolvedProvider);
    }
  }

  if (!resolvedProviders.length) {
    process.stderr.write(
      'Warning: no providers are available. Install at least one CLI tool (claude, codex, copilot, gemini, opencode) and restart.\n'
    );
  }

  // __APP_VERSION__ is injected by esbuild `define` at build time; falls back in dev/test.
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';

  const server = new McpServer({
    name: 'agentic-mcp',
    version,
  });

  registerAllTools(server, resolvedProviders, allProviders);

  server.server.setNotificationHandler(CancelledNotificationSchema, async (notification): Promise<void> => {
    const requestId = toRequestIdString(notification.params.requestId);

    if (!requestId) return;

    const active = getActiveRequest(requestId);

    if (!active) return;

    await killProcess(active.pid);
    unregisterActiveRequest(requestId);
  });

  return server;
};
