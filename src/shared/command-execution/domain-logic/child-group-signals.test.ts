import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CHILD_GROUP_KILL_GRACE_MS } from '../common';

const EXECUTOR_PATH = path.join(import.meta.dirname, 'command-executor.ts');
const SETTLE_MS = 1_000;

const LONG_RUNNING_CHILD = 'setTimeout(() => undefined, 30_000)';
const SIGTERM_IGNORING_CHILD = "process.on('SIGTERM', () => undefined); setTimeout(() => undefined, 30_000)";

// A CLI-mode process (no signal handlers of its own) that starts one long-running provider child.
const buildCliScript = (childCode: string): string => {
  const cliScript = `
import { executeCommand } from ${JSON.stringify(EXECUTOR_PATH)};
void executeCommand({
  binaryPath: process.execPath,
  args: ['-e', ${JSON.stringify(childCode)}],
  env: { PATH: process.env.PATH ?? '' },
  timeoutMs: 30_000,
  bypassSemaphore: true,
  onSpawned: (pid) => process.stdout.write(pid + '\\n'),
});
`;

  return cliScript;
};

// A killed child whose parent already exited can stay a zombie when PID 1 does not reap (containers).
const isZombie = (pid: number): boolean => {
  try {
    const status = readFileSync(`/proc/${String(pid)}/status`, 'utf8');
    const zombie = /^State:\s+Z/m.test(status);

    return zombie;
  } catch {
    return false;
  }
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }

  const alive = !isZombie(pid);

  return alive;
};

type CliPids = {
  readonly cliPid: number;
  readonly childPid: number;
};

const startCliAndReadChildPid = async (childCode: string): Promise<CliPids> => {
  const cliScript = buildCliScript(childCode);
  const cli = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', cliScript], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const childPid = await new Promise<number>((resolve) => {
    cli.stdout.once('data', (data: Buffer) => resolve(Number(data.toString().trim())));
  });
  const pids: CliPids = { cliPid: cli.pid ?? 0, childPid };

  return pids;
};

const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(process.platform === 'win32')('FEATURE: provider children follow a CLI-mode interrupt', () => {
  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)(
    'GIVEN a running provider child WHEN the CLI process gets %s THEN the provider child is stopped',
    async (signal) => {
      const { cliPid, childPid } = await startCliAndReadChildPid(LONG_RUNNING_CHILD);

      process.kill(cliPid, signal);
      await sleep(SETTLE_MS);

      const childAlive = isAlive(childPid);

      if (childAlive) process.kill(childPid, 'SIGKILL');

      expect(childAlive).toBe(false);
    },
    15_000
  );

  it('GIVEN a provider child that ignores SIGTERM WHEN the CLI process gets SIGINT THEN the child is killed after the grace period', async () => {
    const { cliPid, childPid } = await startCliAndReadChildPid(SIGTERM_IGNORING_CHILD);

    await sleep(SETTLE_MS);
    process.kill(cliPid, 'SIGINT');
    await sleep(CHILD_GROUP_KILL_GRACE_MS + SETTLE_MS);

    const childAlive = isAlive(childPid);

    if (childAlive) process.kill(childPid, 'SIGKILL');

    expect(childAlive).toBe(false);
  }, 15_000);
});
