import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const EXECUTOR_PATH = path.join(import.meta.dirname, 'command-executor.ts');
const SETTLE_MS = 1_000;

// A CLI-mode process (no signal handlers of its own) that starts one long-running provider child.
const CLI_SCRIPT = `
import { executeCommand } from ${JSON.stringify(EXECUTOR_PATH)};
void executeCommand({
  binaryPath: process.execPath,
  args: ['-e', 'setTimeout(() => undefined, 30_000)'],
  env: { PATH: process.env.PATH ?? '' },
  timeoutMs: 30_000,
  bypassSemaphore: true,
  onSpawned: (pid) => process.stdout.write(pid + '\\n'),
});
`;

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

const startCliAndReadChildPid = async (): Promise<CliPids> => {
  const cli = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', CLI_SCRIPT], {
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
      const { cliPid, childPid } = await startCliAndReadChildPid();

      process.kill(cliPid, signal);
      await sleep(SETTLE_MS);

      const childAlive = isAlive(childPid);

      if (childAlive) process.kill(childPid, 'SIGKILL');

      expect(childAlive).toBe(false);
    },
    15_000
  );
});
