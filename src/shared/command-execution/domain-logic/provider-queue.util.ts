import type { ProviderQueueOptions } from '../common';
import { CommandExecutionError } from '../common/errors';
import type { ProviderQueueLease, ProviderQueueState, QueuedRequest } from '../common/provider-queue.type';

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

const isOlderWaiter = (candidate: QueuedRequest | undefined, oldest: QueuedRequest | undefined): boolean => {
  if (!candidate) return false;

  const isOlder = !oldest || candidate.enqueuedAtMs < oldest.enqueuedAtMs;

  return isOlder;
};

// A freed global slot goes to the oldest waiter across all providers, so no provider can starve another.
export const findOldestEligibleProvider = (providerStates: Map<string, ProviderQueueState>): string | undefined => {
  let oldestProviderName: string | undefined;
  let oldestRequest: QueuedRequest | undefined;

  for (const [providerName, state] of providerStates.entries()) {
    const headRequest = state.waitQueue[0];
    const hasFreeProviderSlot = state.activeCount < state.maxConcurrency;
    const isOlder = isOlderWaiter(headRequest, oldestRequest);
    const isOldest = hasFreeProviderSlot && isOlder;

    if (!isOldest) continue;

    oldestProviderName = providerName;
    oldestRequest = headRequest;
  }

  return oldestProviderName;
};

export const startQueuedRequest = (
  providerStates: Map<string, ProviderQueueState>,
  providerName: string,
  incrementGlobalActiveCount: () => void
): void => {
  const state = providerStates.get(providerName);
  const queuedRequest = state?.waitQueue.shift();

  if (!state || !queuedRequest) return;

  clearTimeout(queuedRequest.timer);
  state.activeCount++;
  incrementGlobalActiveCount();
  queuedRequest.resolve();
};
