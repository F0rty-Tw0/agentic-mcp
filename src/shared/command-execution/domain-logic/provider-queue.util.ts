import type { ProviderQueueOptions } from '../common';
import { CommandExecutionError, QueueTimeoutError } from '../common/errors';
import type {
  ProviderQueueLease,
  ProviderQueueState,
  QueuedRequest,
  QueuedRequestRef,
} from '../common/provider-queue.type';

const removeQueuedRequest = (waitQueue: QueuedRequest[], queuedRequest: QueuedRequest): boolean => {
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

type RejectQueuedRequestInput = {
  readonly state: ProviderQueueState;
  readonly providerStates: Map<string, ProviderQueueState>;
  readonly options: ProviderQueueOptions;
  readonly queuedRequest: QueuedRequest;
  readonly signal: AbortSignal | undefined;
  readonly onAbort: () => void;
  readonly reject: (reason?: unknown) => void;
  readonly error: Error;
};

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

const buildQueueTimeoutError = (options: ProviderQueueOptions, enqueuedAtMs: number): QueueTimeoutError => {
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

type QueueTimeoutHandlerInput = {
  readonly state: ProviderQueueState;
  readonly providerStates: Map<string, ProviderQueueState>;
  readonly options: ProviderQueueOptions;
  readonly signal: AbortSignal | undefined;
  readonly onAbort: () => void;
  readonly reject: (reason?: unknown) => void;
  readonly queuedRequestRef: QueuedRequestRef;
};

// A request whose provider has a free slot waits only for the global spawn cap, which every run frees within its
// own timeout, so the queue timeout keeps it waiting instead of failing it.
const isOnlyGloballyBlocked = (state: ProviderQueueState): boolean => state.activeCount < state.maxConcurrency;

export const createQueueTimeoutHandler = (input: QueueTimeoutHandlerInput): (() => void) => {
  const { state, providerStates, options, signal, onAbort, reject, queuedRequestRef } = input;

  const onQueueTimeout = (): void => {
    const queuedRequest = queuedRequestRef.current;

    if (!queuedRequest) return;

    const onlyGloballyBlocked = isOnlyGloballyBlocked(state);

    if (onlyGloballyBlocked) {
      queuedRequest.timer = setTimeout(onQueueTimeout, options.queueTimeoutMs);

      return;
    }

    const error = buildQueueTimeoutError(options, queuedRequest.enqueuedAtMs);

    rejectQueuedRequest({ state, providerStates, options, queuedRequest, signal, onAbort, reject, error });
  };

  return onQueueTimeout;
};
