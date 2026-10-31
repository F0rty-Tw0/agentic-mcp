import type { StdioReleasableChild } from '../common';
import { STDIO_RELEASE_GRACE_MS } from '../common';

type CancelStdioRelease = () => void;

type ExitedBeforeKill = () => boolean;

export const releaseStdioAfterKilledExit = (
  child: StdioReleasableChild,
  wasKillRequested: () => boolean
): CancelStdioRelease => {
  let timer: NodeJS.Timeout | undefined;

  const destroyStdio = (): void => {
    child.stdout?.destroy();
    child.stderr?.destroy();
  };

  child.on('exit', () => {
    const killRequested = wasKillRequested();

    if (!killRequested) return;

    timer = setTimeout(destroyStdio, STDIO_RELEASE_GRACE_MS);
  });

  const cancel: CancelStdioRelease = (): void => {
    clearTimeout(timer);
  };

  return cancel;
};

export const trackExitBeforeKill = (child: StdioReleasableChild, wasKillRequested: () => boolean): ExitedBeforeKill => {
  let exitedBeforeKill = false;

  child.on('exit', () => {
    exitedBeforeKill = !wasKillRequested();
  });

  return (): boolean => exitedBeforeKill;
};
