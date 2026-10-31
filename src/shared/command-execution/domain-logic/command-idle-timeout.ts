import type { IdleTimeoutHandle, StopChild } from '../common';

const NOOP_HANDLE: IdleTimeoutHandle = { reset: () => undefined, clear: () => undefined, timedOut: () => false };

export const setupIdleTimeout = (
  idleTimeoutMs: number | undefined,
  stopChild: StopChild | undefined
): IdleTimeoutHandle => {
  if (!idleTimeoutMs || !stopChild) return NOOP_HANDLE;

  let timer: NodeJS.Timeout | undefined;
  let idleTimedOut = false;

  const scheduleKill = (): void => {
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      idleTimedOut = true;
      stopChild();
    }, idleTimeoutMs);
  };

  const reset = (): void => {
    scheduleKill();
  };

  const clear = (): void => {
    if (timer) clearTimeout(timer);
  };

  const idleTimeoutHandle: IdleTimeoutHandle = { reset, clear, timedOut: () => idleTimedOut };

  return idleTimeoutHandle;
};
