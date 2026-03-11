import { killProcess } from './platform.util';

type TimeoutHandle = Readonly<{ timer: NodeJS.Timeout; markTimedOut: () => boolean }>;

type AbortSubscription = Readonly<{ abortHandler: () => void; detach: () => void }>;

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

  return {
    timer,
    markTimedOut: () => timedOut,
  };
};
