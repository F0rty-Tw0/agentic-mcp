import type { ProviderQueueOptions } from '../common';
import { CommandExecutionError, QueueTimeoutError } from '../common/errors';

export type QueuedRequest = Readonly<{
  enqueuedAtMs: number;
  timer: ReturnType<typeof setTimeout>;
  resolve: () => void;
}>;

export type ProviderQueueState = {
  activeCount: number;
  maxConcurrency: number;
  waitQueue: QueuedRequest[];
};

export type ProviderQueueLease = Readonly<{ release: () => void }>;

export const removeQueuedRequest = (waitQueue: QueuedRequest[], queuedRequest: QueuedRequest): boolean => {
  const index = waitQueue.indexOf(queuedRequest);

  if (index === -1) return false;

  waitQueue.splice(index, 1);

  return true;
};

export const cleanupProviderQueueState = (
  providerStates: Map<string, ProviderQueueState>,
  providerName: string
): void => {
  const state = providerStates.get(providerName);

  if (!state || state.activeCount > 0 || state.waitQueue.length > 0) return;

  providerStates.delete(providerName);
};

export const getOrCreateProviderQueueState = (
  providerStates: Map<string, ProviderQueueState>,
  options: ProviderQueueOptions
): ProviderQueueState => {
  const existingState = providerStates.get(options.providerName);

  if (existingState) {
    existingState.maxConcurrency = options.maxConcurrency;

    return existingState;
  }

  const nextState: ProviderQueueState = {
    activeCount: 0,
    maxConcurrency: options.maxConcurrency,
    waitQueue: [],
  };

  providerStates.set(options.providerName, nextState);

  return nextState;
};

export const buildLease = (release: () => void): ProviderQueueLease => {
  let released = false;

  const lease: ProviderQueueLease = {
    release: (): void => {
      if (released) return;

      released = true;
      release();
    },
  };

  return lease;
};

export type RejectQueuedRequestInput = Readonly<{
  state: ProviderQueueState;
  providerStates: Map<string, ProviderQueueState>;
  options: ProviderQueueOptions;
  queuedRequest: QueuedRequest;
  signal: AbortSignal | undefined;
  onAbort: () => void;
  reject: (reason?: unknown) => void;
  error: Error;
}>;

export const buildQueueAbortError = (): CommandExecutionError => {
  const error = new CommandExecutionError('Command cancelled while waiting for provider queue slot', {});

  return error;
};

export const removeAbortListener = (signal: AbortSignal | undefined, onAbort: (() => void) | undefined): void => {
  if (!signal || !onAbort) return;

  signal.removeEventListener('abort', onAbort);
};

export const rejectQueuedRequest = (input: RejectQueuedRequestInput): void => {
  const { state, providerStates, options, queuedRequest, signal, onAbort, reject, error } = input;
  const removed = removeQueuedRequest(state.waitQueue, queuedRequest);

  if (!removed) return;

  clearTimeout(queuedRequest.timer);
  removeAbortListener(signal, onAbort);
  cleanupProviderQueueState(providerStates, options.providerName);
  reject(error);
};

export const buildQueueTimeoutError = (options: ProviderQueueOptions, enqueuedAtMs: number): QueueTimeoutError => {
  const waitMs = Date.now() - enqueuedAtMs;
  const error = new QueueTimeoutError({
    providerName: options.providerName,
    waitMs,
    queueTimeoutMs: options.queueTimeoutMs,
  });

  return error;
};

export const startQueuedRequest = (
  providerStates: Map<string, ProviderQueueState>,
  providerName: string,
  state: ProviderQueueState,
  incrementGlobalActiveCount: () => void
): boolean => {
  const queuedRequest = state.waitQueue.shift();

  if (!queuedRequest) {
    cleanupProviderQueueState(providerStates, providerName);

    return false;
  }

  clearTimeout(queuedRequest.timer);
  state.activeCount++;
  incrementGlobalActiveCount();
  queuedRequest.resolve();
  cleanupProviderQueueState(providerStates, providerName);

  return true;
};
