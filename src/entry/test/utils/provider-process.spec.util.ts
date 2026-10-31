import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const POLL_INTERVAL_MS = 100;

const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Polls instead of fixed sleeps so a slow CI runner does not race a process start or exit.
const pollFor = async <T>(
  probe: () => T | undefined | Promise<T | undefined>,
  limitMs: number
): Promise<T | undefined> => {
  const deadline = Date.now() + limitMs;

  while (Date.now() < deadline) {
    const value = await probe();

    if (value !== undefined) return value;

    await sleep(POLL_INTERVAL_MS);
  }

  return undefined;
};

// A poll can land between the writer's truncate and its write: Number('') is 0, and kill(0) hits the whole group.
export const readPid = async (pidFile: string): Promise<number | undefined> => {
  try {
    const pidText = await readFile(pidFile, 'utf8');
    const parsed = Number(pidText);
    const pid = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

    return pid;
  } catch {
    return undefined;
  }
};

const isMissing = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
  } catch (error) {
    const missing = error instanceof Error && 'code' in error && error.code === 'ESRCH';

    return missing;
  }

  return false;
};

// The process name in /proc/<pid>/stat can hold ") ", so the state is read after the last one.
const readState = (pid: number): string | undefined => {
  try {
    const stat = readFileSync(`/proc/${String(pid)}/stat`, 'utf8');
    const stateIndex = stat.lastIndexOf(') ') + 2;
    const state = stat.charAt(stateIndex);

    return state;
  } catch {
    return undefined;
  }
};

// A killed orphan stays a zombie when PID 1 does not reap (containers), so state Z counts as dead.
export const isProcessDead = (pid: number): boolean => {
  const dead = isMissing(pid) || readState(pid) === 'Z';

  return dead;
};

export const waitForPid = async (pidFile: string, limitMs: number): Promise<number | undefined> => {
  const pid = await pollFor(async () => readPid(pidFile), limitMs);

  return pid;
};

export const waitUntilDead = async (pid: number, limitMs: number): Promise<boolean> => {
  const probeDead = (): true | undefined => {
    const dead = isProcessDead(pid) || undefined;

    return dead;
  };
  const dead = await pollFor(probeDead, limitMs);
  const stopped = dead ?? false;

  return stopped;
};
