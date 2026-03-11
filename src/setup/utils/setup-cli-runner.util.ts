import path from 'node:path';

import { CLIENT_CONFIG_PATHS } from '../common';
import type {
  DetectedProvider,
  ParsedSetupArgs,
  SetupApplyResult,
  SetupCliDependencies,
  SetupPlan,
  SupportedClient,
} from '../common';
import {
  formatHumanMinimalSetupOutput,
  formatHumanSetupOutput,
  formatJsonMinimalSetupOutput,
  formatJsonSetupOutput,
  formatSkillOutput,
  isNonInteractiveWriteBlocked,
  readExistingConfigText,
} from './setup-cli-output.util';

type SetupCliFlowInput = Readonly<{
  parsedArgs: ParsedSetupArgs;
  dependencies: SetupCliDependencies;
  detectedProviders: readonly DetectedProvider[];
}>;

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

  const targetPath = path.join(homeDirectory, CLIENT_CONFIG_PATHS[client] as string);

  return targetPath;
};

const resolveSuggestedClient = (client: SupportedClient): SupportedClient => {
  if (client === 'generic') {
    return 'claude-code';
  }

  return client;
};

const buildConfiguredOutput = (
  parsedArgs: ParsedSetupArgs,
  plan: SetupPlan,
  result: SetupApplyResult,
  detectedProviders: readonly DetectedProvider[]
): string => {
  if (parsedArgs.output === 'json') {
    return formatJsonSetupOutput(parsedArgs, plan, result, detectedProviders);
  }

  return formatHumanSetupOutput(parsedArgs, plan, result, detectedProviders);
};

const buildSetupPlanFromArgs = async (input: SetupCliFlowInput): Promise<SetupPlan> => {
  const { parsedArgs, dependencies, detectedProviders } = input;
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

  return plan;
};

export const runMinimalSetup = async (input: SetupCliFlowInput): Promise<void> => {
  const { parsedArgs, dependencies, detectedProviders } = input;
  const client = resolveSuggestedClient(parsedArgs.client);
  const skillResult = await dependencies.installSkill({ homeDirectory: dependencies.homeDirectory });
  const jsonMinimalSetupOutput = formatJsonMinimalSetupOutput({ client, detectedProviders, skillResult });
  const humanMinimalSetupOutput = formatHumanMinimalSetupOutput({ client, detectedProviders, skillResult });
  const output = parsedArgs.output === 'json' ? jsonMinimalSetupOutput : humanMinimalSetupOutput;

  dependencies.stdoutWrite(output);
};

export const runConfiguredSetup = async (input: SetupCliFlowInput): Promise<void> => {
  const { parsedArgs, dependencies, detectedProviders } = input;
  const plan = await buildSetupPlanFromArgs({ parsedArgs, dependencies, detectedProviders });

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
  const output = buildConfiguredOutput(parsedArgs, plan, result, detectedProviders);

  dependencies.stdoutWrite(output);

  if (parsedArgs.client !== 'claude-code') return;

  const skillResult = await dependencies.installSkill({ homeDirectory: dependencies.homeDirectory });

  dependencies.stdoutWrite(formatSkillOutput(skillResult));
};
