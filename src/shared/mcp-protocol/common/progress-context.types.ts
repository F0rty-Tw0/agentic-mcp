import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

type BaseProgressContext = Pick<RequestHandlerExtra<ServerRequest, ServerNotification>, 'sendNotification' | '_meta'>;

type OptionalProgressContext = Partial<
  Pick<RequestHandlerExtra<ServerRequest, ServerNotification>, 'signal' | 'requestId'>
>;

/**
 * Minimal subset of the MCP SDK's `RequestHandlerExtra` needed by ask handlers.
 * `signal` and `requestId` are optional because some test and transport paths do not provide them.
 */
export type ProgressContext = BaseProgressContext & OptionalProgressContext;
