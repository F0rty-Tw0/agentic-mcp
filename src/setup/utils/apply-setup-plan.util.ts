import { constants as fsConstants } from 'node:fs';
import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SetupApplyResult, SetupFs, SetupPlan } from '../common/index.ts';

const defaultFs: SetupFs = {
  mkdir: async (targetPath, options) => {
    await mkdir(targetPath, options);
  },
  readFile,
  rename,
  writeFile,
  copyFile,
  stat: async (targetPath) => stat(targetPath),
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

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const verifyWrittenConfig = (content: string): SetupApplyResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error: unknown) {
    const reason =
      error instanceof Error ? `Invalid JSON in written file: ${error.message}` : 'Invalid JSON in written file';

    return createFailedVerificationResult(reason);
  }

  if (!isRecord(parsed)) {
    return createFailedVerificationResult('Written config root must be an object.');
  }

  const mcpServers = parsed.mcpServers;

  if (!isRecord(mcpServers)) {
    return createFailedVerificationResult('Written config must include object key mcpServers.');
  }

  if (mcpServers['agentic-mcp'] == null) {
    return createFailedVerificationResult('Written config must include mcpServers["agentic-mcp"].');
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
  const shouldBackup = plan.backup === 'always' || (plan.backup === 'if-exists' && targetExists);

  if (shouldBackup) {
    backupPath = `${plan.targetPath}.bak`;
    await fs.copyFile(plan.targetPath, backupPath, fsConstants.COPYFILE_FICLONE);
  }

  const tempPath = `${plan.targetPath}.tmp`;

  await fs.writeFile(tempPath, plan.configText, 'utf8');
  await fs.rename(tempPath, plan.targetPath);

  const writtenContent = await fs.readFile(plan.targetPath, 'utf8');
  const verification = verifyWrittenConfig(writtenContent);

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
