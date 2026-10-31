import fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providersFileSchema } from '../shared';
import type { ProvidersFile } from '../shared';

const providersJsonUrl = new URL('./providers.json', import.meta.url);
// An env credential overrides a CLI's own login (claude -p always uses ANTHROPIC_API_KEY when set),
// which can switch a subscription user to per-token billing, so the bundled config never passes one.
const CREDENTIAL_NAME_PATTERN = /(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS)/;

const readBundledProviders = async (): Promise<ProvidersFile['providers']> => {
  const content = await fs.readFile(providersJsonUrl, 'utf8');
  const parsedJson: unknown = JSON.parse(content);
  const providers = providersFileSchema.parse(parsedJson).providers;

  return providers;
};

describe('bundled provider env passthrough', () => {
  it('GIVEN the bundled providers WHEN reading envPassthrough THEN no provider passes a credential variable', async () => {
    const providers = await readBundledProviders();
    const passedNames = Object.values(providers).flatMap((provider) => provider.envPassthrough ?? []);
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
