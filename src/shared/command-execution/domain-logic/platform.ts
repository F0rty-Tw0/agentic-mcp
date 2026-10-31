import { execFile } from 'node:child_process';
import process from 'node:process';

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
  'USER',
  'LOGNAME',
  'SHELL',
  'LC_ALL',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'all_proxy',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
] as const;

const sendSignal = (target: number, signal: NodeJS.Signals): boolean => {
  try {
    process.kill(target, signal);
  } catch {
    return false;
  }

  return true;
};

const resolveTerminatedTarget = (pid: number): number | undefined => {
  const groupTarget = -pid;

  const groupSignalled = sendSignal(groupTarget, 'SIGTERM');

  if (groupSignalled) return groupTarget;

  const pidSignalled = sendSignal(pid, 'SIGTERM');

  if (pidSignalled) return pid;

  return undefined;
};

const isAlive = (target: number): boolean => {
  try {
    process.kill(target, 0);
  } catch {
    return false;
  }

  return true;
};

export const killProcess = async (pid: number): Promise<boolean> => {
  if (process.platform === 'win32') {
    return new Promise<boolean>((resolve) => {
      execFile('taskkill', ['/pid', String(pid), '/t', '/f'], (error) => {
        resolve(error === null);
      });
    });
  }

  // POSIX: children are spawned as group leaders, so -pid also reaches descendants holding their stdio.
  const target = resolveTerminatedTarget(pid);

  if (target === undefined) return false;

  return new Promise<boolean>((resolve) => {
    const POLL_INTERVAL_MS = 100;
    let settled = false;

    const killTimer = setTimeout(() => {
      if (settled) return;

      settled = true;
      sendSignal(target, 'SIGKILL');
      resolve(true);
    }, KILL_GRACE_MS);

    killTimer.unref();

    const checkExit = (): void => {
      if (settled) return;

      const alive = isAlive(target);

      if (alive) {
        setTimeout(checkExit, POLL_INTERVAL_MS).unref();

        return;
      }

      settled = true;
      clearTimeout(killTimer);
      resolve(true);
    };

    setTimeout(checkExit, POLL_INTERVAL_MS).unref();
  });
};

export const buildMinimalEnv = (providerEnv: ProviderEnv): MinimalEnv => {
  const env: MutableMinimalEnv = {};
  const providerKeys = Object.keys(providerEnv);
  // Windows env names are case-insensitive and proxy vars come in both cases, so a provider entry replaces every spelling.
  const providerKeysUpper = new Set(providerKeys.map((key) => key.toUpperCase()));

  for (const key of SAFE_ENV_KEYS) {
    const value = process.env[key];
    const upperKey = key.toUpperCase();
    const isSetByProvider = providerKeysUpper.has(upperKey);

    if (value !== undefined && !isSetByProvider) {
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(providerEnv)) {
    if (value !== null) env[key] = value;
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

  const isWindows = process.platform === 'win32';
  const isBatOrCmdBinary = isBatOrCmd.test(resolvedBinary);

  if (isWindows && isBatOrCmdBinary) {
    const allMatches = await which(command, { nothrow: true, all: true });
    const exeMatch = allMatches.find((match) => isExe.test(match));

    if (exeMatch) return exeMatch;

    const isBatBinary = isBat.test(resolvedBinary);

    if (isBatBinary) {
      const cmdMatch = allMatches.find((match) => isCmd.test(match));

      if (cmdMatch) return cmdMatch;
    }
  }

  return resolvedBinary;
};
