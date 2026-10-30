import type { IdleTimeoutHandle } from '../common';
import { killProcess } from './platform';

const NOOP_HANDLE: IdleTimeoutHandle = { reset: () => undefined, clear: () => undefined };

export const setupIdleTimeout = (idleTimeoutMs: number | undefined, pid: number | undefined): IdleTimeoutHandle => {
  if (!idleTimeoutMs || pid === undefined) return NOOP_HANDLE;

  let timer: NodeJS.Timeout | undefined;

  const scheduleKill = (): void => {
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      void killProcess(pid);
    }, idleTimeoutMs);
  };

  const reset = (): void => {
    scheduleKill();
  };

  const clear = (): void => {
    if (timer) clearTimeout(timer);
  };

  const idleTimeoutHandle: IdleTimeoutHandle = { reset, clear };

  return idleTimeoutHandle;
};
