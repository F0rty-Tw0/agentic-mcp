import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import process from 'node:process';
import { createInterface } from 'node:readline';

import type { SetupCliDependencies } from '../common';
import {
  applySetupPlan,
  buildSetupPlan,
  installSkill,
  parseSetupArgs,
  runConfiguredSetup,
  runMinimalSetup,
} from '../utils';
import { detectInstalledProviders } from './detect-providers';
import { generateClientConfigEntry } from './generate-config';

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
  installSkill,
  homeDirectory: homedir(),
  stdoutWrite: (text) => process.stdout.write(text),
  stderrWrite: (text) => process.stderr.write(text),
  isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  promptConfirm: defaultPromptConfirm,
  readConfigFile: async (configPath: string) => readFile(configPath, 'utf8'),
};

export const runSetup = async (
  args: readonly string[],
  injectedDependencies?: Partial<SetupCliDependencies>
): Promise<void> => {
  const dependencies: SetupCliDependencies = { ...defaultDependencies, ...injectedDependencies };
  const parsedArgs = parseSetupArgs({ args, stderrWrite: dependencies.stderrWrite });
  const detectedProviders = await dependencies.detectInstalledProviders();

  if (parsedArgs.minimal) {
    return runMinimalSetup({ parsedArgs, dependencies, detectedProviders });
  }

  return runConfiguredSetup({ parsedArgs, dependencies, detectedProviders });
};
