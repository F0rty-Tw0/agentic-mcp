import { McpServer } from '@modelcontextprotocol/server';

import { loadConfig, warnDangerousFlags } from '../../config/loader';
import { APP_VERSION, resolveCliBinary } from '../../shared';
import type {
  ConfigPathOptions,
  ProviderConfig,
  ResolvedProvider,
  ResolvedProviderEntry,
} from '../../shared/provider/common';
import { registerAllTools } from '../../tool-registry';
import { NO_PROVIDERS_WARNING, SERVER_NAME } from '../common';

type ProviderMetadata = Pick<ResolvedProvider, 'supportLevel' | 'prerequisites'>;

type ConfigOptions = Pick<ConfigPathOptions, 'configPath'>;

const buildSupportLevelMetadata = (providerConfig: ProviderConfig): ProviderMetadata => {
  const { supportLevel } = providerConfig;
  const noMetadata: ProviderMetadata = {};

  if (supportLevel == null) return noMetadata;

  const supportLevelMetadata: ProviderMetadata = { supportLevel };

  return supportLevelMetadata;
};

const buildPrerequisitesMetadata = (providerConfig: ProviderConfig): ProviderMetadata => {
  const { prerequisites } = providerConfig;
  const noMetadata: ProviderMetadata = {};

  if (prerequisites == null) return noMetadata;

  const prerequisitesMetadata: ProviderMetadata = { prerequisites };

  return prerequisitesMetadata;
};

const buildProviderMetadata = (providerConfig: ProviderConfig): ProviderMetadata => {
  const supportLevel = buildSupportLevelMetadata(providerConfig);
  const prerequisites = buildPrerequisitesMetadata(providerConfig);
  const providerMetadata: ProviderMetadata = {
    ...supportLevel,
    ...prerequisites,
  };

  return providerMetadata;
};

const buildConfigOptions = (options?: ConfigPathOptions): ConfigOptions | undefined => {
  const configPath = options?.configPath;

  if (!configPath) return undefined;

  const configOptions: ConfigOptions = { configPath };

  return configOptions;
};

const resolveProviderBinary = async (providerConfig: ProviderConfig): Promise<string | undefined> => {
  if (!providerConfig.enabled) return undefined;

  const binaryPath = await resolveCliBinary(providerConfig.command);

  return binaryPath;
};

export const createServer = async (options?: ConfigPathOptions): Promise<McpServer> => {
  const configOptions = buildConfigOptions(options);
  const config = await loadConfig(configOptions);

  if (options?.warnDangerousFlags) {
    warnDangerousFlags(config, options.providerNames);
  }

  const resolvedProviders: ResolvedProviderEntry[] = [];
  const allProviders: ResolvedProvider[] = [];

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    const binaryPath = await resolveProviderBinary(providerConfig);
    const providerMetadata = buildProviderMetadata(providerConfig);
    const provider: ResolvedProvider = {
      name,
      description: providerConfig.description,
      enabled: providerConfig.enabled,
      available: binaryPath !== undefined,
      binaryPath,
      ...providerMetadata,
    };

    allProviders.push(provider);

    if (providerConfig.enabled && binaryPath) {
      const resolvedProvider: ResolvedProviderEntry = {
        name,
        binaryPath,
        config: providerConfig,
      };

      resolvedProviders.push(resolvedProvider);
    }
  }

  const shouldWarnNoProviders = options?.warnNoProviders !== false;

  if (!resolvedProviders.length && shouldWarnNoProviders) {
    process.stderr.write(NO_PROVIDERS_WARNING);
  }

  const server = new McpServer({
    name: SERVER_NAME,
    version: APP_VERSION,
  });

  registerAllTools(server, resolvedProviders, allProviders);

  return server;
};
