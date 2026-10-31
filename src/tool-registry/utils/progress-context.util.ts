import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ToolRequestContext } from '../common';

export const toProgressContext = (ctx: ToolRequestContext): ProgressContext => {
  const { _meta: requestMeta, id, notify, signal } = ctx.mcpReq;
  const progressContext: ProgressContext = {
    sendNotification: notify,
    ['_meta']: requestMeta,
    signal,
    requestId: id,
  };

  return progressContext;
};
