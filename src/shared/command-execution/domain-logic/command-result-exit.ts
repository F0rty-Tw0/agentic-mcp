import type { ExecuteCommandOptions, ResultExitWatch, StopChild } from '../common';
import { RESULT_EXIT_GRACE_MS } from '../common';

const NOOP_WATCH: ResultExitWatch = { observe: () => undefined, clear: () => undefined, stopped: () => false };

type ResultExitWatchOptions = Pick<ExecuteCommandOptions, 'isResultComplete' | 'resultExitGraceMs'>;

export const setupResultExitWatch = (
  resultExitWatchOptions: ResultExitWatchOptions,
  stopChild: StopChild | undefined
): ResultExitWatch => {
  const { isResultComplete, resultExitGraceMs = RESULT_EXIT_GRACE_MS } = resultExitWatchOptions;

  if (!isResultComplete || !stopChild) return NOOP_WATCH;

  let timer: NodeJS.Timeout | undefined;
  let hasStopped = false;

  const stopAfterGrace = (): void => {
    hasStopped = true;
    stopChild();
  };

  const observe = (chunk: string): void => {
    if (timer) return;

    const isComplete = isResultComplete(chunk);

    if (!isComplete) return;

    timer = setTimeout(stopAfterGrace, resultExitGraceMs);
  };

  const clear = (): void => {
    clearTimeout(timer);
  };

  const resultExitWatch: ResultExitWatch = { observe, clear, stopped: () => hasStopped };

  return resultExitWatch;
};
