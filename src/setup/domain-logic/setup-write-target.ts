import type { SetupFs } from '../common';

const PERMISSION_BITS = 0o777;
// Client configs can hold tokens (`env` blocks, Claude Code's oauthAccount), so a new file is owner-only.
const NEW_CONFIG_FILE_MODE = 0o600;

export const resolveWriteTarget = async (targetPath: string, fs: SetupFs): Promise<string> => {
  try {
    const realTarget = await fs.realpath(targetPath);

    return realTarget;
  } catch {
    return targetPath;
  }
};

export const resolveFileMode = async (targetPath: string, fs: SetupFs): Promise<number> => {
  try {
    const details = await fs.stat(targetPath);
    const mode = details.mode & PERMISSION_BITS;

    return mode;
  } catch {
    return NEW_CONFIG_FILE_MODE;
  }
};

export const resolveBackupPath = async (targetPath: string, fs: SetupFs): Promise<string> => {
  const backupPath = `${targetPath}.bak`;

  try {
    await fs.stat(backupPath);
  } catch {
    return backupPath;
  }

  const timestampedBackupPath = `${targetPath}.${Date.now()}.bak`;

  return timestampedBackupPath;
};
