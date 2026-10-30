import process from 'node:process';

import type { ChildGroupRegistry, UntrackChildGroup } from '../common';

const terminateGroup = (pid: number): void => {
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // Group already exited
  }
};

const TERMINATION_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

export const createChildGroupRegistry = (): ChildGroupRegistry => {
  const liveGroups = new Set<number>();
  let hooksInstalled = false;

  const terminateAll = (): void => {
    liveGroups.forEach(terminateGroup);
    liveGroups.clear();
  };

  // CLI mode has no signal handlers; the server's graceful shutdown exits through the exit hook instead.
  const installSignalForwarder = (signal: NodeJS.Signals): void => {
    const listenerCount = process.listenerCount(signal);
    const isHandledElsewhere = listenerCount > 0;

    if (isHandledElsewhere) return;

    process.once(signal, () => {
      terminateAll();
      process.kill(process.pid, signal);
    });
  };

  const installHooks = (): void => {
    process.once('exit', terminateAll);
    TERMINATION_SIGNALS.forEach(installSignalForwarder);
    hooksInstalled = true;
  };

  const track = (pid: number): UntrackChildGroup => {
    // Detached children miss the terminal's SIGINT/SIGHUP, so their groups are signalled when this process stops.
    if (!hooksInstalled) installHooks();

    liveGroups.add(pid);

    const untrack: UntrackChildGroup = (): void => {
      liveGroups.delete(pid);
    };

    return untrack;
  };

  const childGroupRegistry: ChildGroupRegistry = { track, terminateAll };

  return childGroupRegistry;
};

export const defaultChildGroupRegistry = createChildGroupRegistry();
