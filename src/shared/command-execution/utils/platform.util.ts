import { execFile } from 'node:child_process';
import process from 'node:process';
import { stripVTControlCharacters } from 'node:util';

import which from 'which';

import type { ProviderEnv } from '../../provider/common';

type MinimalEnv = Readonly<Record<string, string>>;
type MutableMinimalEnv = Record<string, string>;

const KILL_GRACE_MS = 5_000;

const SAFE_ENV_KEYS = [
  'PATH',
  'PATHEXT',
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

export const buildMinimalEnv = (providerEnv: ProviderEnv): MinimalEnv => {
  const env: MutableMinimalEnv = {};

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

  if (!resolvedBinary) return undefined;

  // On Windows, .bat/.cmd wrappers often use Read-Host (PowerShell) or CONIN$ for interactive
  // prompts, which hang when spawned as subprocesses. Prefer a real .exe if one exists in PATH.
  // When no .exe exists, prefer .cmd over .bat — npm creates simple .cmd wrappers that work
  // well with cross-spawn, while .bat bootstrappers (e.g., VS Code extensions) often call
  // PowerShell with Read-Host which hangs in non-interactive contexts.
  const isBatOrCmd = /\.(bat|cmd)$/i;
  const isBat = /\.bat$/i;
  const isCmd = /\.cmd$/i;
  const isExe = /\.exe$/i;

  if (process.platform === 'win32' && isBatOrCmd.test(resolvedBinary)) {
    const allMatches = await which(command, { nothrow: true, all: true });
    const exeMatch = allMatches.find((match) => isExe.test(match));

    if (exeMatch) return exeMatch;

    if (isBat.test(resolvedBinary)) {
      const cmdMatch = allMatches.find((match) => isCmd.test(match));

      if (cmdMatch) return cmdMatch;
    }
  }

  return resolvedBinary;
};

export const stripAnsi = (input: string): string => stripVTControlCharacters(input);
