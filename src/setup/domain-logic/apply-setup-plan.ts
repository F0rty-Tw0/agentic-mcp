import { constants as fsConstants } from 'node:fs';
import { copyFile, mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveBackupPath, resolveFileMode, resolveWriteTarget } from './setup-write-target';
import { CLIENT_TARGETS } from '../common';
import type { SetupApplyResult, SetupFs, SetupPlan } from '../common';
import { verifyWrittenConfig } from '../utils';

const defaultFs: SetupFs = {
  mkdir: async (targetPath, options) => {
    await mkdir(targetPath, options);
  },
  readFile,
  rename,
  writeFile,
  copyFile,
  stat: async (targetPath) => stat(targetPath),
  realpath: async (targetPath) => realpath(targetPath),
};

const hasExistingFile = async (targetPath: string, fs: SetupFs): Promise<boolean> => {
  try {
    const details = await fs.stat(targetPath);

    return details.isFile();
  } catch {
    return false;
  }
};

// A dry run, or an entry that already matches: nothing is written and nothing is backed up.
const resolveNoWriteResult = (plan: SetupPlan): SetupApplyResult | undefined => {
  if (plan.writeIntent === 'skip') {
    const skippedResult: SetupApplyResult = {
      status: 'skipped',
      path: plan.targetPath,
      backupPath: undefined,
    };

    return skippedResult;
  }

  if (plan.writeIntent === 'unchanged') {
    const unchangedResult: SetupApplyResult = {
      status: 'unchanged',
      path: plan.targetPath,
      backupPath: undefined,
      reason: 'already configured; the agentic-mcp entry is up to date, so no file or backup was written',
    };

    return unchangedResult;
  }

  return undefined;
};

export const applySetupPlan = async (plan: SetupPlan, fs: SetupFs = defaultFs): Promise<SetupApplyResult> => {
  const noWriteResult = resolveNoWriteResult(plan);

  if (noWriteResult != null) return noWriteResult;

  if (plan.writeIntent === 'manual' || plan.targetPath == null) {
    const manualResult: SetupApplyResult = {
      status: 'manual',
      path: plan.targetPath,
      backupPath: undefined,
    };

    return manualResult;
  }

  await fs.mkdir(path.dirname(plan.targetPath), { recursive: true });

  let backupPath: string | undefined = undefined;
  const targetExists = await hasExistingFile(plan.targetPath, fs);
  const shouldBackupExisting = plan.backup === 'if-exists' && targetExists;
  const shouldBackup = plan.backup === 'always' || shouldBackupExisting;

  if (shouldBackup) {
    backupPath = await resolveBackupPath(plan.targetPath, fs);
    await fs.copyFile(plan.targetPath, backupPath, fsConstants.COPYFILE_FICLONE);
  }

  const writeTarget = await resolveWriteTarget(plan.targetPath, fs);
  const mode = await resolveFileMode(writeTarget, fs);
  // A fresh name per run: writeFile only applies `mode` when it creates the file.
  const tempPath = `${writeTarget}.${String(process.pid)}.${String(Date.now())}.tmp`;

  await fs.writeFile(tempPath, plan.configText, { encoding: 'utf8', mode });
  await fs.rename(tempPath, writeTarget);

  const writtenContent = await fs.readFile(plan.targetPath, 'utf8');
  const verification = verifyWrittenConfig(writtenContent, CLIENT_TARGETS[plan.client]);

  if (verification.status !== 'written') {
    const failedResult: SetupApplyResult = {
      status: verification.status,
      path: plan.targetPath,
      backupPath,
      reason: verification.reason,
    };

    return failedResult;
  }

  const writtenResult: SetupApplyResult = {
    status: 'written',
    path: plan.targetPath,
    backupPath,
  };

  return writtenResult;
};
