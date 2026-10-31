import type { McpServer } from '@modelcontextprotocol/server';

import { createServer } from '../../server';
import type { ConfigPathOptions } from '../../shared/provider/common';

type ServerFactory = () => Promise<McpServer>;

export const createServerFactory = async (options?: ConfigPathOptions): Promise<ServerFactory> => {
  const startupServer = await createServer(options);
  const unclaimedServers: McpServer[] = [startupServer];

  const serverFactory = async (): Promise<McpServer> => {
    const server = unclaimedServers.pop() ?? (await createServer(options));

    return server;
  };

  return serverFactory;
};
