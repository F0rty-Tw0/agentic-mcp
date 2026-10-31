import type { ResultCompleteDetector, ResultExitWatch } from '../common';
import { RESULT_EXIT_GRACE_MS } from '../common';
import { killProcess } from './platform';

const NOOP_WATCH: ResultExitWatch = { observe: () => undefined, clear: () => undefined, stopped: () => false };

export const setupResultExitWatch = (
  isResultComplete: ResultCompleteDetector | undefined,
  pid: number | undefined
): ResultExitWatch => {
  if (!isResultComplete || pid === undefined) return NOOP_WATCH;

  let timer: NodeJS.Timeout | undefined;
  let hasStopped = false;

  const stopChild = (): void => {
    hasStopped = true;
    void killProcess(pid);
  };

  const observe = (chunk: string): void => {
    if (timer) return;

    const isComplete = isResultComplete(chunk);

    if (!isComplete) return;

    timer = setTimeout(stopChild, RESULT_EXIT_GRACE_MS);
  };

  const clear = (): void => {
    clearTimeout(timer);
  };

  const resultExitWatch: ResultExitWatch = { observe, clear, stopped: () => hasStopped };

  return resultExitWatch;
};
