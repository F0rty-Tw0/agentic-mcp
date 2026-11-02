import type { ClientToolTimeout, SetupCliDependencies, SetupCliFlowInput, SetupPlan } from '../common';
import { resolveTargetPath } from './plan-setup.util';
import { buildDefaultClientToolTimeout, resolveClientToolTimeout } from './resolve-client-tool-timeout.util';
import { readExistingConfigText } from './setup-cli-output.util';

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

export const buildSetupPlanFromArgs = async (input: SetupCliFlowInput): Promise<SetupPlan> => {
  const { parsedArgs, dependencies, detectedProviders } = input;
  const toolTimeout = await resolveToolTimeout(dependencies);
  const serverEntry = dependencies.generateClientConfigEntry(parsedArgs.client, detectedProviders, toolTimeout.ms);
  const targetPath = resolveTargetPath({
    client: parsedArgs.client,
    homeDirectory: dependencies.homeDirectory,
    pathOverride: parsedArgs.pathOverride,
  });
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
