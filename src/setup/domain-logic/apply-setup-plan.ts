import { constants as fsConstants } from 'node:fs';
import { copyFile, mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveBackupPath, resolveFileMode, resolveWriteTarget } from './setup-write-target';
import { CLIENT_TARGETS } from '../common';
import type { SetupApplyResult, SetupFs, SetupPlan } from '../common';

type JsonRecord = Readonly<Record<string, unknown>>;

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

const createFailedVerificationResult = (reason: string): SetupApplyResult => {
  const result: SetupApplyResult = {
    status: 'verification-failed',
    path: undefined,
    backupPath: undefined,
    reason,
  };

  return result;
};

const isRecord = (value: unknown): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const verifyWrittenConfig = (content: string, serversKey: string): SetupApplyResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error: unknown) {
    const reason =
      error instanceof Error ? `Invalid JSON in written file: ${error.message}` : 'Invalid JSON in written file';

    return createFailedVerificationResult(reason);
  }

  if (!isRecord(parsed)) return createFailedVerificationResult('Written config root must be an object.');

  const servers = parsed[serversKey];

  if (!isRecord(servers))
    return createFailedVerificationResult(`Written config must include object key ${serversKey}.`);

  if (servers['agentic-mcp'] == null) {
    return createFailedVerificationResult(`Written config must include ${serversKey}["agentic-mcp"].`);
  }

  const successResult: SetupApplyResult = {
    status: 'written',
    path: undefined,
    backupPath: undefined,
  };

  return successResult;
};

export const applySetupPlan = async (plan: SetupPlan, fs: SetupFs = defaultFs): Promise<SetupApplyResult> => {
  if (plan.writeIntent === 'skip') {
    const skippedResult: SetupApplyResult = {
      status: 'skipped',
      path: plan.targetPath,
      backupPath: undefined,
    };

    return skippedResult;
  }

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
  const verification = verifyWrittenConfig(writtenContent, CLIENT_TARGETS[plan.client].serversKey);

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
