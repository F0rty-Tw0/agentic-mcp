import process from 'node:process';

import type { ChildGroupRegistry, UntrackChildGroup } from '../common';

const terminateGroup = (pid: number): void => {
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // Group already exited
  }
};

export const createChildGroupRegistry = (): ChildGroupRegistry => {
  const liveGroups = new Set<number>();
  let exitHookInstalled = false;

  const terminateAll = (): void => {
    liveGroups.forEach(terminateGroup);
    liveGroups.clear();
  };

  const track = (pid: number): UntrackChildGroup => {
    // Detached children miss the terminal's SIGINT/SIGHUP, so the server signals their groups as it exits.
    if (!exitHookInstalled) process.once('exit', terminateAll);

    exitHookInstalled = true;
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
