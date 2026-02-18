import fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providersFileSchema } from '../common/provider-config.schema.ts';

const providersJsonUrl = new URL('./providers.json', import.meta.url);
const providersSchemaUrl = new URL('./providers.schema.json', import.meta.url);

const readJson = async (url: URL): Promise<unknown> => {
  const content = await fs.readFile(url, 'utf8');

  return JSON.parse(content) as unknown;
};

describe('providers config', () => {
  it('declares a local $schema pointer', async () => {
    const config = (await readJson(providersJsonUrl)) as { $schema?: unknown };

    expect(config.$schema).toBe('./providers.schema.json');
  });

  it('conforms to Zod runtime schema', async () => {
    const config = await readJson(providersJsonUrl);
    const parsed = providersFileSchema.safeParse(config);

    if (!parsed.success) {
      throw new Error(
        parsed.error.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('\n'),
      );
    }

    expect(parsed.success).toBe(true);
  });

  it('has a valid local JSON Schema descriptor', async () => {
    const schema = (await readJson(providersSchemaUrl)) as Record<string, unknown>;

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');

    const properties = schema.properties as Record<string, unknown>;
    const defs = schema.$defs as Record<string, unknown>;

    expect(properties.providers).toBeDefined();
    expect(defs.providerConfig).toBeDefined();
    expect(defs.commandDef).toBeDefined();
    expect(defs.flagValue).toBeDefined();
    expect(defs.leveledFlag).toBeDefined();
  });

  it('every provider has an "ask" command', async () => {
    const config = (await readJson(providersJsonUrl)) as {
      providers: Record<string, { commands: Record<string, unknown> }>;
    };

    for (const [name, provider] of Object.entries(config.providers)) {
      expect(provider.commands.ask, `${name} must have an "ask" command`).toBeDefined();
    }
  });

  it('every provider has outputFormat at top level', async () => {
    const config = (await readJson(providersJsonUrl)) as {
      providers: Record<string, { outputFormat?: unknown }>;
    };

    for (const [name, provider] of Object.entries(config.providers)) {
      expect(provider.outputFormat, `${name} must have "outputFormat" at top level`).toBeDefined();
    }
  });

  it('no provider has a capabilities object', async () => {
    const config = (await readJson(providersJsonUrl)) as {
      providers: Record<string, Record<string, unknown>>;
    };

    for (const [name, provider] of Object.entries(config.providers)) {
      expect(
        provider.capabilities,
        `${name} must not have a "capabilities" object`,
      ).toBeUndefined();
    }
  });
});
