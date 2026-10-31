import fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providersFileSchema } from '../shared';
import type { ProvidersFile } from '../shared';

const providersJsonUrl = new URL('./providers.json', import.meta.url);
// An env credential overrides a CLI's own login (claude -p always uses ANTHROPIC_API_KEY when set),
// which can switch a subscription user to per-token billing, so the bundled config never passes one.
const CREDENTIAL_NAME_PATTERN = /(API_?KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS|(^|_)PAT($|_))/i;

const readBundledProviders = async (): Promise<ProvidersFile['providers']> => {
  const content = await fs.readFile(providersJsonUrl, 'utf8');
  const parsedJson: unknown = JSON.parse(content);
  const providers = providersFileSchema.parse(parsedJson).providers;

  return providers;
};

describe('bundled provider env passthrough', () => {
  it('GIVEN the bundled providers WHEN reading envPassthrough THEN no provider passes or sets a credential variable', async () => {
    const providers = await readBundledProviders();
    const providerConfigs = Object.values(providers);
    const passthroughNames = providerConfigs.flatMap((provider) => provider.envPassthrough ?? []);
    const envNames = providerConfigs.flatMap((provider) => Object.keys(provider.env));
    const passedNames = [...passthroughNames, ...envNames];
    const credentialNames = passedNames.filter((name) => CREDENTIAL_NAME_PATTERN.test(name));

    expect(credentialNames).toStrictEqual([]);
  });

  it.each([
    ['claude', 'CLAUDE_CONFIG_DIR'],
    ['codex', 'CODEX_HOME'],
    ['copilot', 'COPILOT_HOME'],
    ['opencode', 'OPENCODE_CONFIG'],
  ])('GIVEN the bundled %s provider WHEN reading envPassthrough THEN it passes %s', async (name, variable) => {
    const providers = await readBundledProviders();
    const passthrough = providers[name]?.envPassthrough ?? [];

    expect(passthrough).toContain(variable);
  });
});
