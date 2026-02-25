import { resolveCliBinary } from '../../shared/utils';
import { KNOWN_PROVIDER_COMMANDS } from '../common';
import type { DetectedProvider } from '../common';

export const detectInstalledProviders = async (): Promise<readonly DetectedProvider[]> => {
  const results = await Promise.all(
    KNOWN_PROVIDER_COMMANDS.map(async (name) => {
      const resolvedBinaryPath = await resolveCliBinary(name);
      const binaryPath = resolvedBinaryPath ?? undefined;

      const provider: DetectedProvider = {
        name,
        available: binaryPath !== undefined,
        binaryPath,
      };

      return provider;
    })
  );

  return results;
};
