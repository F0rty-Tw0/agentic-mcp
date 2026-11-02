import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import process from 'node:process';
import { createInterface } from 'node:readline';

import { loadConfig } from '../../config/loader';
import type { SetupCliDependencies } from '../common';
import { buildSetupPlan, parseSetupArgs, runConfiguredSetup, runMinimalSetup } from '../utils';
import { applySetupPlan } from './apply-setup-plan';
import { detectInstalledProviders } from './detect-providers';
import { generateClientConfigEntry } from './generate-config';
import { installSkill } from './install-skill';

// The prompt goes to stderr so --output json keeps stdout parseable; Ctrl-C or Ctrl-D closes the input and declines.
const defaultPromptConfirm = async (question: string): Promise<boolean> => {
  const readLine = createInterface({ input: process.stdin, output: process.stderr });

  return new Promise<boolean>((resolve) => {
    readLine.once('close', () => {
      resolve(false);
    });
    readLine.question(question, (answer) => {
      // Settle before close(), whose 'close' event would otherwise settle the promise as declined.
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
      readLine.close();
    });
  });
};

const defaultDependencies: SetupCliDependencies = {
  detectInstalledProviders,
  generateClientConfigEntry,
  // The same resolution the server uses without --config: AGENTIC_MCP_CONFIG, user-local, then bundled.
  loadProvidersConfig: async () => loadConfig(),
  buildSetupPlan,
  applySetupPlan,
  installSkill,
  homeDirectory: homedir(),
  stdoutWrite: (text) => process.stdout.write(text),
  stderrWrite: (text) => process.stderr.write(text),
  isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  promptConfirm: defaultPromptConfirm,
  readConfigFile: async (configPath: string) => readFile(configPath, 'utf8'),
  env: process.env,
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const runSetup = async (args: string[], injectedDependencies?: Partial<SetupCliDependencies>): Promise<void> => {
  const dependencies: SetupCliDependencies = { ...defaultDependencies, ...injectedDependencies };
  const parsedArgs = parseSetupArgs({ args, stderrWrite: dependencies.stderrWrite });
  const detectedProviders = await dependencies.detectInstalledProviders();

  if (parsedArgs.minimal) return runMinimalSetup({ parsedArgs, dependencies, detectedProviders });

  return runConfiguredSetup({ parsedArgs, dependencies, detectedProviders });
};
