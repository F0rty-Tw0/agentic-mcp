import type { ServerContext } from '@modelcontextprotocol/server';

type ToolRequest = Pick<ServerContext['mcpReq'], 'id' | '_meta' | 'signal' | 'notify'>;

export type ToolRequestContext = {
  readonly mcpReq: ToolRequest;
};
