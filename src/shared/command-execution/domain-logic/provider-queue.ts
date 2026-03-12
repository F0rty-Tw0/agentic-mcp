import { DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS, GLOBAL_MAX_CONCURRENT_SPAWNS } from '../common';
import type { ProviderQueueOptions } from '../common';
import type { ProviderQueueLease, ProviderQueueState, QueuedRequest } from './provider-queue.util';
import {
  buildLease,
  buildQueueAbortError,
  buildQueueTimeoutError,
  cleanupProviderQueueState,
  getOrCreateProviderQueueState,
  rejectQueuedRequest,
  removeAbortListener,
  startQueuedRequest,
} from './provider-queue.util';

export type ProviderQueueStore = Readonly<{
  acquireSlot: (options: ProviderQueueOptions) => Promise<ProviderQueueLease>;
}>;

type CreateProviderQueueStoreOptions = Readonly<{ globalMaxConcurrency?: number }>;

const createDrainQueues = (
  providerStates: Map<string, ProviderQueueState>,
  globalMaxConcurrency: number,
  getGlobalActiveCount: () => number,
  incrementGlobalActiveCount: () => void
): (() => void) => {
  return (): void => {
    if (getGlobalActiveCount() >= globalMaxConcurrency) return;

    for (const [providerName, state] of providerStates.entries()) {
      if (getGlobalActiveCount() >= globalMaxConcurrency) return;

      if (state.activeCount >= state.maxConcurrency) continue;

      if (startQueuedRequest(providerStates, providerName, state, incrementGlobalActiveCount)) return;
    }
  };
};

const createReleaseProviderSlot = (
  providerStates: Map<string, ProviderQueueState>,
  decrementGlobalActiveCount: () => void,
  drainQueues: () => void
): ((providerName: string) => void) => {
  return (providerName: string): void => {
    const state = providerStates.get(providerName);

    if (!state) return;

    state.activeCount--;
    decrementGlobalActiveCount();
    cleanupProviderQueueState(providerStates, providerName);
    drainQueues();
  };
};

const waitForQueuedSlot = async (
  state: ProviderQueueState,
  providerStates: Map<string, ProviderQueueState>,
  options: ProviderQueueOptions
): Promise<void> => {
  const enqueuedAtMs = Date.now();
  const signal = options.signal;

  if (signal?.aborted) throw buildQueueAbortError();

  await new Promise<void>((resolve, reject) => {
    const queuedRequestRef: { current?: QueuedRequest } = {};
    const onAbort = (): void => {
      const queuedRequest = queuedRequestRef.current;

      if (!queuedRequest) return;

      rejectQueuedRequest({
        state,
        providerStates,
        options,
        queuedRequest,
        signal,
        onAbort,
        reject,
        error: buildQueueAbortError(),
      });
    };

    const queuedRequest: QueuedRequest = {
      enqueuedAtMs,
      timer: setTimeout(() => {
        rejectQueuedRequest({
          state,
          providerStates,
          options,
          queuedRequest,
          signal,
          onAbort,
          reject,
          error: buildQueueTimeoutError(options, queuedRequest.enqueuedAtMs),
        });
      }, options.queueTimeoutMs),
      resolve: (): void => {
        removeAbortListener(signal, onAbort);
        resolve();
      },
    };

    queuedRequestRef.current = queuedRequest;
    state.waitQueue.push(queuedRequest);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
};

export const createProviderQueueStore = (options: CreateProviderQueueStoreOptions = {}): ProviderQueueStore => {
  const globalMaxConcurrency = options.globalMaxConcurrency ?? GLOBAL_MAX_CONCURRENT_SPAWNS;
  const providerStates = new Map<string, ProviderQueueState>();
  let globalActiveCount = 0;
  const incrementGlobalActiveCount = (): void => {
    globalActiveCount++;
  };
  const decrementGlobalActiveCount = (): void => {
    globalActiveCount--;
  };
  const getGlobalActiveCount = (): number => globalActiveCount;
  const drainQueues = createDrainQueues(
    providerStates,
    globalMaxConcurrency,
    getGlobalActiveCount,
    incrementGlobalActiveCount
  );
  const releaseProviderSlot = createReleaseProviderSlot(providerStates, decrementGlobalActiveCount, drainQueues);
  const acquireSlot = async (providerQueueOptions: ProviderQueueOptions): Promise<ProviderQueueLease> => {
    const normalizedOptions: ProviderQueueOptions = {
      ...providerQueueOptions,
      queueTimeoutMs: providerQueueOptions.queueTimeoutMs || DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS,
    };
    const state = getOrCreateProviderQueueState(providerStates, normalizedOptions);

    if (state.activeCount < state.maxConcurrency && globalActiveCount < globalMaxConcurrency) {
      state.activeCount++;
      incrementGlobalActiveCount();

      return buildLease(() => releaseProviderSlot(normalizedOptions.providerName));
    }

    await waitForQueuedSlot(state, providerStates, normalizedOptions);

    return buildLease(() => releaseProviderSlot(normalizedOptions.providerName));
  };

  return { acquireSlot };
};

export const defaultProviderQueueStore = createProviderQueueStore();
