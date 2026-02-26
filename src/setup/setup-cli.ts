import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';

import { CLIENT_CONFIG_PATHS } from './common';
import type {
  DetectedProvider,
  McpServerEntry,
  SetupApplyResult,
  SetupBackupPolicy,
  SetupMode,
  SetupPlan,
  SupportedClient,
} from './common';
import { detectInstalledProviders } from './domain-logic/detect-providers';
import { generateClientConfigEntry } from './domain-logic/generate-config';
import { applySetupPlan } from './utils/apply-setup-plan.util';
import { buildSetupPlan } from './utils/plan-setup.util';
import { parseSetupArgs } from './utils/setup-cli-args.util';
import {
  formatHumanSetupOutput,
  formatJsonSetupOutput,
  isNonInteractiveWriteBlocked,
  readExistingConfigText,
} from './utils/setup-cli-output.util';

type SetupCliDependencies = Readonly<{
  detectInstalledProviders: () => Promise<readonly DetectedProvider[]>;
  generateClientConfigEntry: (
    client: SupportedClient,
    detectedProviders: readonly DetectedProvider[]
  ) => McpServerEntry;
  buildSetupPlan: (input: {
    client: SupportedClient;
    homeDirectory: string;
    pathOverride?: string;
    mode: SetupMode;
    dryRun: boolean;
    existingConfigText?: string;
    agenticServerEntry: McpServerEntry;
    backup: SetupBackupPolicy;
  }) => SetupPlan;
  applySetupPlan: (plan: SetupPlan) => Promise<SetupApplyResult>;
  homeDirectory: string;
  stdoutWrite: (text: string) => void;
  stderrWrite: (text: string) => void;
  isInteractive: boolean;
  promptConfirm: (question: string) => Promise<boolean>;
  readConfigFile: (path: string) => Promise<string>;
}>;

const defaultPromptConfirm = async (question: string): Promise<boolean> => {
  const readLine = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise<boolean>((resolve) => {
    readLine.question(question, (answer) => {
      readLine.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
};

const defaultDependencies: SetupCliDependencies = {
  detectInstalledProviders,
  generateClientConfigEntry,
  buildSetupPlan,
  applySetupPlan,
  homeDirectory: homedir(),
  stdoutWrite: (text) => process.stdout.write(text),
  stderrWrite: (text) => process.stderr.write(text),
  isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  promptConfirm: defaultPromptConfirm,
  readConfigFile: async (configPath: string) => readFile(configPath, 'utf8'),
};

const resolveTargetPath = (
  homeDirectory: string,
  client: SupportedClient,
  pathOverride?: string
): string | undefined => {
  if (pathOverride != null) {
    return pathOverride;
  }

  if (client === 'generic') {
    return undefined;
  }

  return path.join(homeDirectory, CLIENT_CONFIG_PATHS[client] as string);
};

export const runSetup = async (
  args: readonly string[],
  injectedDependencies?: Partial<SetupCliDependencies>
): Promise<void> => {
  const dependencies: SetupCliDependencies = { ...defaultDependencies, ...injectedDependencies };
  const parsedArgs = parseSetupArgs({ args, stderrWrite: dependencies.stderrWrite });

  const detectedProviders = await dependencies.detectInstalledProviders();
  const serverEntry = dependencies.generateClientConfigEntry(parsedArgs.client, detectedProviders);
  const targetPath = resolveTargetPath(dependencies.homeDirectory, parsedArgs.client, parsedArgs.pathOverride);
  const existingConfigText = await readExistingConfigText(targetPath, dependencies.readConfigFile);

  const plan = dependencies.buildSetupPlan({
    client: parsedArgs.client,
    homeDirectory: dependencies.homeDirectory,
    pathOverride: parsedArgs.pathOverride,
    mode: parsedArgs.mode,
    dryRun: parsedArgs.dryRun,
    existingConfigText,
    agenticServerEntry: serverEntry,
    backup: parsedArgs.backup,
  });

  if (isNonInteractiveWriteBlocked(parsedArgs, plan, dependencies.isInteractive)) {
    dependencies.stderrWrite(
      'Aborted: non-interactive write requires explicit --yes. Use --yes to run non-interactive writes.\n'
    );

    return;
  }

  if (dependencies.isInteractive && !parsedArgs.yes && plan.writeIntent === 'write') {
    const confirmed = await dependencies.promptConfirm(`Write config to ${plan.targetPath}? [y/N] `);

    if (!confirmed) {
      dependencies.stdoutWrite('Aborted. No files written.\n');

      return;
    }
  }

  const result = await dependencies.applySetupPlan(plan);
  const output =
    parsedArgs.output === 'json'
      ? formatJsonSetupOutput(parsedArgs, plan, result, detectedProviders)
      : formatHumanSetupOutput(parsedArgs, plan, result, detectedProviders);

  dependencies.stdoutWrite(output);
};
