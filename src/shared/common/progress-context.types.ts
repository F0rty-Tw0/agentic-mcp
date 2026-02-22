import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Minimal subset of the MCP SDK's `RequestHandlerExtra` needed for progress heartbeats.
 * Kept narrow to avoid coupling the handler to the full SDK server types.
 */
export type ProgressContext = Pick<
  RequestHandlerExtra<ServerRequest, ServerNotification>,
  'sendNotification' | '_meta'
>;
