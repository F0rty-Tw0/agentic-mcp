import type { ProviderQueueOptions } from '../common';
import { GLOBAL_SLOT_MAX_EXTRA_WAIT_MS } from '../common';
import { rejectQueuedRequest } from './provider-queue.util';
import { QueueTimeoutError } from '../common/errors';
import type { ProviderQueueState, QueuedRequestRef } from '../common/provider-queue.type';

type QueueWaitLimit = Pick<ProviderQueueOptions, 'providerName' | 'queueTimeoutMs'>;

const buildQueueTimeoutError = (waitLimit: QueueWaitLimit, enqueuedAtMs: number): QueueTimeoutError => {
  const waitMs = Date.now() - enqueuedAtMs;
  const error = new QueueTimeoutError({
    providerName: waitLimit.providerName,
    waitMs,
    queueTimeoutMs: waitLimit.queueTimeoutMs,
  });

  return error;
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

// A request whose provider has a free slot waits only for the global spawn cap. Freed global slots go to the oldest
// waiter, so it keeps waiting past its queue timeout, but no longer than its globalSlotExtraWaitMs more.
const isOnlyGloballyBlocked = (state: ProviderQueueState): boolean => state.activeCount < state.maxConcurrency;

const resolveWaitLimitMs = (state: ProviderQueueState, options: ProviderQueueOptions): number => {
  const onlyGloballyBlocked = isOnlyGloballyBlocked(state);
  const globalSlotExtraWaitMs = options.globalSlotExtraWaitMs ?? GLOBAL_SLOT_MAX_EXTRA_WAIT_MS;
  const extraWaitMs = onlyGloballyBlocked ? globalSlotExtraWaitMs : 0;
  const waitLimitMs = options.queueTimeoutMs + extraWaitMs;

  return waitLimitMs;
};

const resolveRearmDelayMs = (
  state: ProviderQueueState,
  options: ProviderQueueOptions,
  enqueuedAtMs: number
): number => {
  const onlyGloballyBlocked = isOnlyGloballyBlocked(state);

  if (!onlyGloballyBlocked) return 0;

  const remainingMs = enqueuedAtMs + resolveWaitLimitMs(state, options) - Date.now();
  const rearmDelayMs = Math.min(options.queueTimeoutMs, remainingMs);

  return rearmDelayMs;
};

export const createQueueTimeoutHandler = (input: QueueTimeoutHandlerInput): (() => void) => {
  const { state, providerStates, options, signal, onAbort, reject, queuedRequestRef } = input;

  const onQueueTimeout = (): void => {
    const queuedRequest = queuedRequestRef.current;

    if (!queuedRequest) return;

    const rearmDelayMs = resolveRearmDelayMs(state, options, queuedRequest.enqueuedAtMs);

    if (rearmDelayMs > 0) {
      queuedRequest.timer = setTimeout(onQueueTimeout, rearmDelayMs);

      return;
    }

    const waitLimit: QueueWaitLimit = {
      providerName: options.providerName,
      queueTimeoutMs: resolveWaitLimitMs(state, options),
    };
    const error = buildQueueTimeoutError(waitLimit, queuedRequest.enqueuedAtMs);

    rejectQueuedRequest({ state, providerStates, options, queuedRequest, signal, onAbort, reject, error });
  };

  return onQueueTimeout;
};
