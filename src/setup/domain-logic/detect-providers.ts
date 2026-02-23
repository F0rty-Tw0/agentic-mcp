import { resolveCliBinary } from '../../shared/utils/index.ts';
import { KNOWN_PROVIDER_COMMANDS } from '../common/index.ts';
import type { DetectedProvider } from '../common/index.ts';

export const detectInstalledProviders = async (): Promise<readonly DetectedProvider[]> => {
  const results = await Promise.all(
    KNOWN_PROVIDER_COMMANDS.map(async (name) => {
      const binaryPath = await resolveCliBinary(name);

      const provider: DetectedProvider = {
        name,
        available: binaryPath !== null,
        binaryPath,
      };

      return provider;
    })
  );

  return results;
};
