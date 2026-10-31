import type { ExecuteCommandOptions, ResultExitWatch } from '../common';
import { RESULT_EXIT_GRACE_MS } from '../common';
import { killProcess } from './platform';

const NOOP_WATCH: ResultExitWatch = { observe: () => undefined, clear: () => undefined, stopped: () => false };

type ResultExitWatchOptions = Pick<ExecuteCommandOptions, 'isResultComplete' | 'resultExitGraceMs'>;

export const setupResultExitWatch = (
  resultExitWatchOptions: ResultExitWatchOptions,
  pid: number | undefined
): ResultExitWatch => {
  const { isResultComplete, resultExitGraceMs = RESULT_EXIT_GRACE_MS } = resultExitWatchOptions;

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

    timer = setTimeout(stopChild, resultExitGraceMs);
  };

  const clear = (): void => {
    clearTimeout(timer);
  };

  const resultExitWatch: ResultExitWatch = { observe, clear, stopped: () => hasStopped };

  return resultExitWatch;
};
