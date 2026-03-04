import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CancelledNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, warnDangerousFlags } from '../../config/loader';
import type { ConfigPathOptions, ResolvedProvider, ResolvedProviderEntry } from '../../shared';
import { APP_VERSION, getActiveRequest, killProcess, resolveCliBinary, unregisterActiveRequest } from '../../shared';
import { registerAllTools } from '../../tool-registry';
import { NO_PROVIDERS_WARNING, SERVER_NAME } from '../common';
import { toRequestIdString } from '../utils';

export const createServer = async (options?: ConfigPathOptions): Promise<McpServer> => {
  const config = await loadConfig(options);

  warnDangerousFlags(config);

  const resolvedProviders: ResolvedProviderEntry[] = [];
  const allProviders: ResolvedProvider[] = [];

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    const binaryPath = providerConfig.enabled ? await resolveCliBinary(providerConfig.command) : undefined;

    const provider: ResolvedProvider = {
      name,
      description: providerConfig.description,
      enabled: providerConfig.enabled,
      available: binaryPath !== undefined,
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
    process.stderr.write(NO_PROVIDERS_WARNING);
  }

  const server = new McpServer({
    name: SERVER_NAME,
    version: APP_VERSION,
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
