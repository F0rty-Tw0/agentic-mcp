import process from 'node:process';

import { runCli } from '../../cli';
import type { DetectedProvider } from '../../setup/common';
import { detectInstalledProviders } from '../../setup/domain-logic/detect-providers';
import { DEFAULT_PROVE_PROMPT } from '../common';
import type { ProveCliDependencies, ProveCliInput } from '../common';

type RequestedProviderInput = Readonly<{
  requestedProviderName?: string;
  forwardedArgs: readonly string[];
}>;

const defaultDependencies: ProveCliDependencies = {
  detectInstalledProviders,
  runCli,
  stdoutWrite: (text) => process.stdout.write(text),
  stderrWrite: (text) => process.stderr.write(text),
};

const resolveRequestedProviderInput = (args: readonly string[]): RequestedProviderInput => {
  const [firstArg] = args;

  if (firstArg == null || firstArg.startsWith('--')) {
    const result: RequestedProviderInput = {
      forwardedArgs: args,
    };

    return result;
  }

  const result: RequestedProviderInput = {
    requestedProviderName: firstArg,
    forwardedArgs: args.slice(1),
  };

  return result;
};

const findDetectedProvider = (
  detectedProviders: readonly DetectedProvider[],
  requestedProviderName?: string
): DetectedProvider | undefined => {
  if (requestedProviderName) {
    const requestedProvider = detectedProviders.find(
      (provider) => provider.available && provider.name === requestedProviderName
    );

    return requestedProvider;
  }

  const detectedProvider = detectedProviders.find((provider) => provider.available);

  return detectedProvider;
};

const writeFailure = (stderrWrite: (text: string) => void, message: string): void => {
  stderrWrite(`${message}\n`);
  process.exitCode = 1;
};

const buildMissingProviderMessage = (requestedProviderName: string): string =>
  `Requested provider "${requestedProviderName}" is not currently detected. Next: run agentic-mcp list_providers to see detected providers, or install and authenticate ${requestedProviderName}.`;

const buildNoDetectedProvidersMessage = (): string =>
  'No detected provider CLI is available for prove. Next: install and authenticate a supported provider CLI, then run agentic-mcp list_providers.';

export const runProve = async (proveCliInput: ProveCliInput): Promise<void> => {
  const { args, configPath, dependencies = defaultDependencies } = proveCliInput;
  const {
    detectInstalledProviders: detectInstalledProvidersDependency,
    runCli: runCliDependency,
    stdoutWrite,
    stderrWrite,
  } = dependencies;
  const requestedProviderInput = resolveRequestedProviderInput(args);
  const detectedProviders = await detectInstalledProvidersDependency();
  const detectedProvider = findDetectedProvider(detectedProviders, requestedProviderInput.requestedProviderName);

  if (!detectedProvider && requestedProviderInput.requestedProviderName) {
    const message = buildMissingProviderMessage(requestedProviderInput.requestedProviderName);

    writeFailure(stderrWrite, message);

    return;
  }

  if (!detectedProvider) {
    const message = buildNoDetectedProvidersMessage();

    writeFailure(stderrWrite, message);

    return;
  }

  const proveSubcommand = `ask_${detectedProvider.name}`;
  const proveArgs = [DEFAULT_PROVE_PROMPT, ...requestedProviderInput.forwardedArgs];

  stdoutWrite(`Proving ${detectedProvider.name} with a real ask...\n`);

  await runCliDependency(proveSubcommand, proveArgs, configPath);
};
