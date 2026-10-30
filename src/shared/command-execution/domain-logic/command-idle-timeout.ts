import type { IdleTimeoutHandle } from '../common';
import { killProcess } from './platform';

const NOOP_HANDLE: IdleTimeoutHandle = { reset: () => undefined, clear: () => undefined, timedOut: () => false };

export const setupIdleTimeout = (idleTimeoutMs: number | undefined, pid: number | undefined): IdleTimeoutHandle => {
  if (!idleTimeoutMs || pid === undefined) return NOOP_HANDLE;

  let timer: NodeJS.Timeout | undefined;
  let idleTimedOut = false;

  const scheduleKill = (): void => {
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      idleTimedOut = true;
      void killProcess(pid);
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
