import fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providersFileSchema } from '../shared';
import type { ProvidersFile } from '../shared';

const providersJsonUrl = new URL('./providers.json', import.meta.url);
const SIXTY_MINUTES_MS = 3_600_000;
const TEN_MINUTES_MS = 600_000;

type ProviderConfigs = ProvidersFile['providers'][string][];

type IdleTimeoutEntry = [string, number];

const readBundledProviderConfigs = async (): Promise<ProviderConfigs> => {
  const content = await fs.readFile(providersJsonUrl, 'utf8');
  const parsedJson: unknown = JSON.parse(content);
  const providers = providersFileSchema.parse(parsedJson).providers;
  const providerConfigs = Object.values(providers);

  return providerConfigs;
};

const toIdleTimeoutEntries = (provider: ProviderConfigs[number]): IdleTimeoutEntry[] => {
  if (provider.idleTimeout == null) return [];

  const entry: IdleTimeoutEntry = [provider.command, provider.idleTimeout];
  const entries = [entry];

  return entries;
};

describe('FEATURE: bundled provider run limits', () => {
  describe('GIVEN the bundled providers config', () => {
    it('WHEN reading each provider timeout THEN every provider may run for 60 minutes', async () => {
      const providerConfigs = await readBundledProviderConfigs();
      const timeouts = providerConfigs.map((provider) => provider.timeout);
      const timeoutSet = new Set(timeouts);
      const distinctTimeouts = [...timeoutSet];

      expect(distinctTimeouts).toStrictEqual([SIXTY_MINUTES_MS]);
    });

    it('WHEN reading the queueTimeoutMs values that are set THEN each waits 10 minutes for a slot', async () => {
      const providerConfigs = await readBundledProviderConfigs();
      const queueTimeouts = providerConfigs.flatMap((provider) => provider.queueTimeoutMs ?? []);
      const queueTimeoutSet = new Set(queueTimeouts);
      const distinctQueueTimeouts = [...queueTimeoutSet];

      expect(distinctQueueTimeouts).toStrictEqual([TEN_MINUTES_MS]);
    });

    it('WHEN reading the idleTimeout values that are set THEN only copilot sets one and it allows 10 minutes of silence', async () => {
      const providerConfigs = await readBundledProviderConfigs();
      const idleTimeouts = providerConfigs.flatMap(toIdleTimeoutEntries);
      const expectedIdleTimeouts: IdleTimeoutEntry[] = [['copilot', TEN_MINUTES_MS]];

      expect(idleTimeouts).toStrictEqual(expectedIdleTimeouts);
    });
  });
});
