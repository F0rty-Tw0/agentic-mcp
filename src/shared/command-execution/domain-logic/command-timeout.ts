import { killProcess } from './platform';

type TimeoutHandle = { readonly timer: NodeJS.Timeout; readonly markTimedOut: () => boolean };

type AbortSubscription = { readonly abortHandler: () => void; readonly detach: () => void };

export const createAbortSubscription = (signal?: AbortSignal, childPid?: number): AbortSubscription => {
  const abortHandler = (): void => {
    if (childPid === undefined) return;

    void killProcess(childPid);
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

export const setupTimeout = (timeoutMs: number, pid?: number): TimeoutHandle => {
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;

    if (pid === undefined) return;

    void killProcess(pid);
  }, timeoutMs);

  const timeoutHandle: TimeoutHandle = {
    timer,
    markTimedOut: () => timedOut,
  };

  return timeoutHandle;
};
