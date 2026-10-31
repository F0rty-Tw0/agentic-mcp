import type { RequestId, RequestMeta, ServerNotification } from '@modelcontextprotocol/server';

export type ProgressContext = {
  sendNotification: (notification: ServerNotification) => Promise<void>;
  ['_meta']?: RequestMeta;
  signal?: AbortSignal;
  readonly requestId?: RequestId;
};
