import process from 'node:process';

import { handleAsk } from '../../ask';
import { handleAskAll } from '../../ask-all';
import { loadConfig, warnDangerousFlags } from '../../config/loader';
import { handleProviderMetrics } from '../../provider-metrics';
import type { ResolvedProvider, ResolvedProviderEntry } from '../../shared';
import { resolveCliBinary } from '../../shared';
import { handleHelp, handleListProviders, handlePing } from '../../simple-tools';
import { parseAskAllArgs, parseAskArgs, parseSubcommand } from '../utils';
import { printResult } from './cli-output';

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

  const resolvedProviders: ResolvedProviderEntry[] = [];
  const allProviders: ResolvedProvider[] = [];

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    const binaryPath = providerConfig.enabled ? await resolveCliBinary(providerConfig.command) : undefined;

    const provider: ResolvedProvider = {
      name,
      description: providerConfig.description,
      enabled: providerConfig.enabled,
      available: binaryPath !== undefined,
      binaryPath,
    };

    allProviders.push(provider);

    if (providerConfig.enabled && binaryPath) {
      resolvedProviders.push({ name, binaryPath, config: providerConfig });
    }
  }

  switch (parsed.type) {
    case 'ask': {
      const provider = resolvedProviders.find((p) => p.name === parsed.providerName);

      if (!provider) {
        process.stderr.write(`Provider not found or not available: ${parsed.providerName}\n`);
        process.exitCode = 1;

        return;
      }
      warnDangerousFlags(config, [provider.name]);
      const askArgs = parseAskArgs(remainingArgs);
      const result = await handleAsk(provider, askArgs);

      printResult(result);

      return;
    }
    case 'ask_all': {
      warnDangerousFlags(config);
      const askAllArgs = parseAskAllArgs(remainingArgs);
      const result = await handleAskAll(resolvedProviders, askAllArgs);

      printResult(result);

      return;
    }
    case 'ping': {
      const provider = resolvedProviders.find((p) => p.name === parsed.providerName);

      if (!provider) {
        process.stderr.write(`Provider not found or not available: ${parsed.providerName}\n`);
        process.exitCode = 1;

        return;
      }
      const result = await handlePing(provider);

      printResult(result);

      return;
    }
    case 'help': {
      const provider = resolvedProviders.find((p) => p.name === parsed.providerName);

      if (!provider) {
        process.stderr.write(`Provider not found or not available: ${parsed.providerName}\n`);
        process.exitCode = 1;

        return;
      }
      const result = await handleHelp(provider);

      printResult(result);

      return;
    }
    case 'list_providers': {
      const result = handleListProviders(allProviders);

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
