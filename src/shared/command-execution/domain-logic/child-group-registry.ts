import process from 'node:process';

import type { ChildGroupRegistry, UntrackChildGroup } from '../common';
import { CHILD_GROUP_KILL_GRACE_MS, CHILD_GROUP_POLL_INTERVAL_MS } from '../common';
import { installSignalForwarders } from './child-group-signal-forwarder';

const MAX_GRACE_POLLS = CHILD_GROUP_KILL_GRACE_MS / CHILD_GROUP_POLL_INTERVAL_MS;

const signalGroup = (pid: number, signal: NodeJS.Signals): void => {
  try {
    process.kill(-pid, signal);
  } catch {
    // Group already exited
  }
};

const terminateGroup = (pid: number): void => {
  signalGroup(pid, 'SIGTERM');
};

const killGroup = (pid: number): void => {
  signalGroup(pid, 'SIGKILL');
};

const isGroupAlive = (pid: number): boolean => {
  try {
    process.kill(-pid, 0);
  } catch {
    return false;
  }

  return true;
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const waitForGroupsToExit = async (pids: number[], pollsLeft: number): Promise<number[]> => {
  const survivors = pids.filter(isGroupAlive);
  const isSettled = survivors.length === 0 || pollsLeft === 0;

  if (isSettled) return survivors;

  await sleep(CHILD_GROUP_POLL_INTERVAL_MS);

  const remaining = await waitForGroupsToExit(survivors, pollsLeft - 1);

  return remaining;
};

export const createChildGroupRegistry = (): ChildGroupRegistry => {
  const liveGroups = new Set<number>();
  let hooksInstalled = false;
  let isShuttingDown = false;

  // Groups stay tracked during the grace period, so an exit hook firing meanwhile still kills them.
  const terminateAll = async (): Promise<void> => {
    isShuttingDown = true;

    const pids = [...liveGroups];

    pids.forEach(terminateGroup);

    const survivors = await waitForGroupsToExit(pids, MAX_GRACE_POLLS);

    survivors.forEach(killGroup);
    pids.forEach((pid) => liveGroups.delete(pid));
  };

  // A sync exit hook cannot wait out a grace period, so whatever is still tracked there gets SIGKILL.
  const killAll = (): void => {
    liveGroups.forEach(killGroup);
    liveGroups.clear();
  };

  const installHooks = (): void => {
    process.once('exit', killAll);
    installSignalForwarders({ terminateAll, killAll, isShuttingDown: () => isShuttingDown });
    hooksInstalled = true;
  };

  const untrackNothing: UntrackChildGroup = (): void => undefined;

  const track = (pid: number): UntrackChildGroup => {
    // A group spawned after shutdown began would miss terminateAll's snapshot.
    if (isShuttingDown) {
      killGroup(pid);

      return untrackNothing;
    }

    // Detached children miss the terminal's SIGINT/SIGHUP, so their groups are signalled when this process stops.
    if (!hooksInstalled) installHooks();

    liveGroups.add(pid);

    const untrack: UntrackChildGroup = (): void => {
      liveGroups.delete(pid);
    };

    return untrack;
  };

  const childGroupRegistry: ChildGroupRegistry = { track, terminateAll, killAll };

  return childGroupRegistry;
};

export const defaultChildGroupRegistry = createChildGroupRegistry();
