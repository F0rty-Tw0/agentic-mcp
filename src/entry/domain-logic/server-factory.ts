import type { McpServer } from '@modelcontextprotocol/server';

import { createServer } from '../../server';
import type { ConfigPathOptions } from '../../shared/provider/common';

type ServerFactory = () => Promise<McpServer>;

export const createServerFactory = async (options?: ConfigPathOptions): Promise<ServerFactory> => {
  const startupServer = await createServer(options);
  const unclaimedServers: McpServer[] = [startupServer];

  // A client that probes server/discover and then falls back to a 2025 handshake gets a second instance;
  // its startup warnings were already printed for the first one.
  const repeatOptions: ConfigPathOptions = { ...options, warnDangerousFlags: false, warnNoProviders: false };

  const serverFactory = async (): Promise<McpServer> => {
    const server = unclaimedServers.pop() ?? (await createServer(repeatOptions));

    return server;
  };

  return serverFactory;
};
