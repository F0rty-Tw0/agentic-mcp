import fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providersFileSchema } from '../common/provider-config.schema.js';

const providersJsonUrl = new URL('./providers.json', import.meta.url);
const providersSchemaUrl = new URL('./providers.schema.json', import.meta.url);

async function readJson(url: URL): Promise<unknown> {
  const content = await fs.readFile(url, 'utf8');

  return JSON.parse(content) as unknown;
}

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
    const schema = (await readJson(providersSchemaUrl)) as {
      $schema?: unknown;
      properties?: {
        providers?: unknown;
      };
      $defs?: {
        providerConfig?: unknown;
      };
    };

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.properties?.providers).toBeDefined();
    expect(schema.$defs?.providerConfig).toBeDefined();
  });
});
