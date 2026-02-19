import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { stripVTControlCharacters } from 'node:util';

import which from 'which';

const KILL_GRACE_MS = 5_000;

const SAFE_ENV_KEYS = [
  'PATH',
  'HOME',
  'USERPROFILE',
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
    const timer = setTimeout(() => {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Process already exited
      }
      resolve(true);
    }, KILL_GRACE_MS);

    timer.unref();
  });
};

export const buildMinimalEnv = (providerEnv: Record<string, string | null>): Record<string, string> => {
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

export const resolveCliBinary = async (command: string): Promise<string | null> => {
  return which(command, { nothrow: true });
};

export const stripAnsi = (input: string): string => stripVTControlCharacters(input);

export const normalizePath = (inputPath: string): string => {
  return path.resolve(inputPath).replace(/\\/g, '/');
};
