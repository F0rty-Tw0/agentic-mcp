import process from 'node:process';

import { handleAsk } from '../../ask';
import { handleAskAll } from '../../ask-all';
import { loadConfig, warnDangerousFlags } from '../../config/loader';
import { handleProviderMetrics } from '../../provider-metrics';
import type { ProvidersFile, ResolvedProvider, ResolvedProviderEntry } from '../../shared';
import { resolveCliBinary } from '../../shared';
import { handleHelp, handleListProviders, handlePing } from '../../simple-tools';
import { parseAskAllArgs, parseAskArgs, parseSubcommand } from '../utils';
import { printResult } from './cli-output';

type ResolvedProviders = Readonly<{
  all: ResolvedProvider[];
  available: ResolvedProviderEntry[];
}>;

const resolveProviders = async (config: ProvidersFile): Promise<ResolvedProviders> => {
  const all: ResolvedProvider[] = [];
  const available: ResolvedProviderEntry[] = [];

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    const binaryPath = providerConfig.enabled ? await resolveCliBinary(providerConfig.command) : undefined;

    const provider: ResolvedProvider = {
      name,
      description: providerConfig.description,
      enabled: providerConfig.enabled,
      available: binaryPath !== undefined,
      binaryPath,
    };

    all.push(provider);

    if (providerConfig.enabled && binaryPath) {
      const entry: ResolvedProviderEntry = { name, binaryPath, config: providerConfig };

      available.push(entry);
    }
  }

  const result: ResolvedProviders = { all, available };

  return result;
};

const findProviderOrFail = (
  providers: readonly ResolvedProviderEntry[],
  name: string
): ResolvedProviderEntry | undefined => {
  const provider = providers.find((p) => p.name === name);

  if (!provider) {
    process.stderr.write(`Provider not found or not available: ${name}\n`);
    process.exitCode = 1;
  }

  return provider;
};

const dispatchCommand = async (
  parsed: NonNullable<ReturnType<typeof parseSubcommand>>,
  remainingArgs: readonly string[],
  config: ProvidersFile,
  providers: ResolvedProviders
): Promise<void> => {
  switch (parsed.type) {
    case 'ask': {
      const provider = findProviderOrFail(providers.available, parsed.providerName as string);

      if (!provider) return;

      warnDangerousFlags(config, [provider.name]);
      const askArgs = parseAskArgs(remainingArgs);
      const result = await handleAsk(provider, askArgs);

      printResult(result);

      return;
    }
    case 'ask_all': {
      warnDangerousFlags(config);
      const askAllArgs = parseAskAllArgs(remainingArgs);
      const result = await handleAskAll(providers.available, askAllArgs);

      printResult(result);

      return;
    }
    case 'ping': {
      const provider = findProviderOrFail(providers.available, parsed.providerName as string);

      if (!provider) return;

      const result = await handlePing(provider);

      printResult(result);

      return;
    }
    case 'help': {
      const provider = findProviderOrFail(providers.available, parsed.providerName as string);

      if (!provider) return;

      const result = await handleHelp(provider);

      printResult(result);

      return;
    }
    case 'list_providers': {
      const result = handleListProviders(providers.all);

      printResult(result);

      return;
    }
    case 'provider_metrics': {
      const result = handleProviderMetrics();

      printResult(result);

      return;
    }
  }
};

export const runCli = async (
  subcommand: string,
  remainingArgs: readonly string[],
  configPath?: string
): Promise<void> => {
  const parsed = parseSubcommand(subcommand);

  if (!parsed) {
    process.stderr.write(`Unknown command: ${subcommand}\n`);
    process.exitCode = 1;

    return;
  }

  const options = configPath ? { configPath } : undefined;
  const config = await loadConfig(options);
  const providers = await resolveProviders(config);

  await dispatchCommand(parsed, remainingArgs, config, providers);
};
