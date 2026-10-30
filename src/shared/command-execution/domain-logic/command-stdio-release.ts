import type { StdioReleasableChild } from '../common';
import { STDIO_RELEASE_GRACE_MS } from '../common';

type CancelStdioRelease = () => void;

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
