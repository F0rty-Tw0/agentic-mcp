import type { StopChild } from '../common';

type TimeoutHandle = { readonly timer: NodeJS.Timeout; readonly markTimedOut: () => boolean };

type AbortSubscription = { readonly abortHandler: () => void; readonly detach: () => void };

export const createAbortSubscription = (signal?: AbortSignal, stopChild?: StopChild): AbortSubscription => {
  const abortHandler = (): void => {
    stopChild?.();
  };

  if (!signal) {
    const abortSubscription: AbortSubscription = { abortHandler, detach: () => undefined };

    return abortSubscription;
  }

  if (signal.aborted) abortHandler();

  signal.addEventListener('abort', abortHandler, { once: true });

  const abortSubscription: AbortSubscription = {
    abortHandler,
    detach: (): void => {
      signal.removeEventListener('abort', abortHandler);
    },
  };

  return abortSubscription;
};

export const setupTimeout = (timeoutMs: number, stopChild?: StopChild): TimeoutHandle => {
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    stopChild?.();
  }, timeoutMs);

  const timeoutHandle: TimeoutHandle = {
    timer,
    markTimedOut: () => timedOut,
  };

  return timeoutHandle;
};
