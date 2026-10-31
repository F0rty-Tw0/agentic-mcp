import type { ChildStop, KillProcessOptions, StopChild, StoppableChild } from '../common';
import { STDIO_RELEASE_GRACE_MS } from '../common';
import { killProcess } from './platform';

type StopRequest = () => KillProcessOptions;

const buildStopChild = (pid: number | undefined, requestStop: StopRequest): StopChild | undefined => {
  if (pid === undefined) return;

  const stopChild: StopChild = (): void => {
    const killProcessOptions = requestStop();

    void killProcess(pid, killProcessOptions);
  };

  return stopChild;
};

// After a stop, a descendant outside the child's process group can keep stdout open, so stdio is released after a grace period.
export const setupChildStop = (child: StoppableChild): ChildStop => {
  let releaseTimer: NodeJS.Timeout | undefined;
  let hasExited = false;
  let stopRequested = false;
  let exitedBeforeStop = false;

  const destroyStdio = (): void => {
    child.stdout?.destroy();
    child.stderr?.destroy();
  };

  const scheduleRelease = (): void => {
    if (releaseTimer) return;

    releaseTimer = setTimeout(destroyStdio, STDIO_RELEASE_GRACE_MS);
  };

  child.on('exit', () => {
    hasExited = true;
    exitedBeforeStop = !stopRequested;

    if (stopRequested) scheduleRelease();
  });

  const requestStop: StopRequest = () => {
    stopRequested = true;

    if (hasExited) scheduleRelease();

    const killProcessOptions: KillProcessOptions = { childExited: hasExited };

    return killProcessOptions;
  };

  const cancelRelease = (): void => {
    clearTimeout(releaseTimer);
  };

  const stop = buildStopChild(child.pid, requestStop);
  const childStop: ChildStop = { stop, exitedBeforeStop: () => exitedBeforeStop, cancelRelease };

  return childStop;
};
