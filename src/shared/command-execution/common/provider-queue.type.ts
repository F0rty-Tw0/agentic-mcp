export type QueuedRequest = {
  readonly enqueuedAtMs: number;
  timer: ReturnType<typeof setTimeout>;
  readonly resolve: () => void;
};

export type QueuedRequestRef = { current?: QueuedRequest };

export type ProviderQueueState = {
  // eslint-disable-next-line local/readonly-type-properties -- the queue store counts slots in place
  activeCount: number;
  // eslint-disable-next-line local/readonly-type-properties -- refreshed in place from the latest queue options
  maxConcurrency: number;
  waitQueue: QueuedRequest[];
};

export type ProviderQueueLease = { readonly release: () => void };
