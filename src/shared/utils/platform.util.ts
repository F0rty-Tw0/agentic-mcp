import { execFile } from 'node:child_process';
import process from 'node:process';
import { stripVTControlCharacters } from 'node:util';

import which from 'which';

import type { ProviderEnv } from '../common';

const KILL_GRACE_MS = 5_000;

const SAFE_ENV_KEYS = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'SYSTEMROOT',
  'COMSPEC',
] as const;

export const killProcess = async (pid: number): Promise<boolean> => {
  if (process.platform === 'win32') {
    return new Promise<boolean>((resolve) => {
      execFile('taskkill', ['/pid', String(pid), '/t', '/f'], (error) => {
        resolve(error === null);
      });
    });
  }

  // POSIX: SIGTERM, then SIGKILL after grace period
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const POLL_INTERVAL_MS = 100;
    let settled = false;

    const killTimer = setTimeout(() => {
      if (settled) return;

      settled = true;

      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Process already exited
      }

      resolve(true);
    }, KILL_GRACE_MS);

    killTimer.unref();

    const checkExit = (): void => {
      if (settled) return;

      try {
        process.kill(pid, 0); // Existence check — throws if process is gone
        setTimeout(checkExit, POLL_INTERVAL_MS).unref();
      } catch {
        settled = true;
        clearTimeout(killTimer);
        resolve(true);
      }
    };

    setTimeout(checkExit, POLL_INTERVAL_MS).unref();
  });
};

export const buildMinimalEnv = (providerEnv: ProviderEnv): Readonly<Record<string, string>> => {
  const env: Record<string, string> = {};

  for (const key of SAFE_ENV_KEYS) {
    const value = process.env[key];

    if (value !== undefined) {
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(providerEnv)) {
    env[key] = value ?? '';
  }

  return env;
};

export const resolveCliBinary = async (command: string): Promise<string | undefined> => {
  const resolvedBinary = await which(command, { nothrow: true });

  return resolvedBinary ?? undefined;
};

export const stripAnsi = (input: string): string => stripVTControlCharacters(input);
