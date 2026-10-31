import path from 'node:path';

import { CLIENT_TARGETS } from '../common';
import type {
  ClientToolTimeout,
  ConfiguredSetupOutputInput,
  DetectedProvider,
  ParsedSetupArgs,
  SetupCliDependencies,
  SetupPlan,
  SkillInstallResult,
  SupportedClient,
} from '../common';
import { buildDefaultClientToolTimeout, resolveClientToolTimeout } from './resolve-client-tool-timeout.util';
import {
  formatHumanMinimalSetupOutput,
  formatHumanSetupOutput,
  formatJsonMinimalSetupOutput,
  formatJsonSetupOutput,
  isConsentRequired,
  isNonInteractiveWriteBlocked,
  readExistingConfigText,
} from './setup-cli-output.util';

type SetupCliFlowInput = {
  readonly parsedArgs: ParsedSetupArgs;
  readonly dependencies: SetupCliDependencies;
  readonly detectedProviders: DetectedProvider[];
};

const resolveTargetPath = (
  homeDirectory: string,
  client: SupportedClient,
  pathOverride?: string
): string | undefined => {
  if (pathOverride != null) return pathOverride;

  if (client === 'generic') return undefined;

  const clientConfigPath = CLIENT_TARGETS[client].configPath;

  if (clientConfigPath == null) return undefined;

  const targetPath = path.join(homeDirectory, clientConfigPath);

  return targetPath;
};

const resolveSuggestedClient = (client: SupportedClient): SupportedClient => {
  if (client === 'generic') return 'claude-code';

  return client;
};

const buildConfiguredOutput = (input: ConfiguredSetupOutputInput): string => {
  if (input.parsedArgs.output === 'json') return formatJsonSetupOutput(input);

  return formatHumanSetupOutput(input);
};

const installClientSkill = async (input: SetupCliFlowInput): Promise<SkillInstallResult | undefined> => {
  const { parsedArgs, dependencies } = input;

  if (parsedArgs.client !== 'claude-code') return undefined;

  const skillResult = await dependencies.installSkill({ homeDirectory: dependencies.homeDirectory });

  return skillResult;
};

// The server fails to start on a config that does not load, so the defaults only shape the preview here.
const resolveToolTimeout = async (dependencies: SetupCliDependencies): Promise<ClientToolTimeout> => {
  try {
    const providersConfig = await dependencies.loadProvidersConfig();
    const providers = Object.values(providersConfig.providers);

    return resolveClientToolTimeout(providers);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const [firstLine = ''] = message.split('\n');
    const cause = firstLine === '' ? '' : ` (${firstLine})`;
    const defaultTimeout = buildDefaultClientToolTimeout(`the providers config could not be loaded${cause}`);

    return defaultTimeout;
  }
};

const buildSetupPlanFromArgs = async (input: SetupCliFlowInput): Promise<SetupPlan> => {
  const { parsedArgs, dependencies, detectedProviders } = input;
  const toolTimeout = await resolveToolTimeout(dependencies);
  const serverEntry = dependencies.generateClientConfigEntry(parsedArgs.client, detectedProviders, toolTimeout.ms);
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
    env: dependencies.env,
    toolTimeout,
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

  const isWriteBlocked = isNonInteractiveWriteBlocked(parsedArgs, plan, dependencies.isInteractive);

  if (isWriteBlocked) {
    dependencies.stderrWrite(
      'Aborted: non-interactive write requires explicit --yes. Use --yes to run non-interactive writes.\n'
    );

    return;
  }

  const isConsentNeeded = isConsentRequired(plan);

  if (dependencies.isInteractive && !parsedArgs.yes && isConsentNeeded) {
    const confirmed = await dependencies.promptConfirm(`Write config to ${plan.targetPath}? [y/N] `);

    if (!confirmed) {
      dependencies.stdoutWrite('Aborted. No files written.\n');

      return;
    }
  }

  const result = await dependencies.applySetupPlan(plan);
  const skillResult = await installClientSkill(input);
  const output = buildConfiguredOutput({ parsedArgs, plan, result, detectedProviders, skillResult });

  dependencies.stdoutWrite(output);
};
