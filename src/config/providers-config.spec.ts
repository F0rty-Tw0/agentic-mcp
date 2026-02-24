import fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providersFileSchema } from "../shared/common";
import type { ProvidersFile } from "../shared/common";

const providersJsonUrl = new URL('./providers.json', import.meta.url);
const providersSchemaUrl = new URL('./providers.schema.json', import.meta.url);

const readJson = async (url: URL): Promise<unknown> => {
  const content = await fs.readFile(url, 'utf8');

  return JSON.parse(content);
};

type Providers = ProvidersFile['providers'];

const validProviderConfig: Providers[string] = {
  enabled: true,
  description: 'Example provider config for schema tests',
  command: 'example-cli',
  timeout: 120000,
  env: {},
  outputFormat: 'json',
  commands: {
    ask: {
      args: ['run'],
    },
  },
  input: {
    method: 'positional',
  },
};

type ProviderConfigWithoutOutputFormat = Omit<ProvidersFile['providers'][string], 'outputFormat'>;

const buildProvidersConfig = (provider: unknown): unknown => ({
  configVersion: 1,
  providers: {
    example: provider,
  },
});

const removeOutputFormat = (provider: ProvidersFile['providers'][string]): ProviderConfigWithoutOutputFormat => {
  const providerEntries = Object.entries(provider).filter(([key]) => key !== 'outputFormat');

  return Object.fromEntries(providerEntries) as ProviderConfigWithoutOutputFormat;
};

describe('providers config', () => {
  it('GIVEN providers.json WHEN reading metadata THEN it declares a local $schema pointer', async () => {
    const config = (await readJson(providersJsonUrl)) as ProvidersFile;

    expect(config.$schema).toBe('./providers.schema.json');
  });

  it('GIVEN bundled providers config WHEN validating with Zod THEN it passes', async () => {
    const config = await readJson(providersJsonUrl);
    const parsed = providersFileSchema.safeParse(config);

    if (!parsed.success) {
      throw new Error(
        parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n')
      );
    }

    expect(parsed.success).toBe(true);
  });

  it('GIVEN provider config without outputFormat WHEN validating THEN it fails', () => {
    const providerWithoutOutputFormat = removeOutputFormat(validProviderConfig);
    const parsed = providersFileSchema.safeParse(buildProvidersConfig(providerWithoutOutputFormat));

    expect(parsed.success).toBe(false);

    if (parsed.success) {
      throw new Error('Expected provider config without outputFormat to fail validation');
    }

    const outputFormatIssue = parsed.error.issues.find(
      (issue) => issue.path.join('.') === 'providers.example.outputFormat'
    );

    expect(outputFormatIssue).toBeDefined();
  });

  it('GIVEN provider config without ask command WHEN validating THEN it fails', () => {
    const providerWithoutAsk: ProvidersFile['providers'][string] = {
      ...validProviderConfig,
      commands: {
        sessions: {
          args: ['sessions'],
        },
      },
    };
    const parsed = providersFileSchema.safeParse(buildProvidersConfig(providerWithoutAsk));

    expect(parsed.success).toBe(false);

    if (parsed.success) {
      throw new Error('Expected provider config without ask command to fail validation');
    }

    const askIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'providers.example.commands');

    expect(askIssue?.message).toContain('ask');
  });

  it('GIVEN providers.schema.json WHEN reading descriptors THEN required keys are present', async () => {
    const schema = (await readJson(providersSchemaUrl)) as Record<string, unknown>;

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');

    const properties = schema.properties as Record<string, unknown>;
    const defs = schema.$defs as Record<string, unknown>;

    expect(properties.providers).toBeDefined();
    expect(defs.providerConfig).toBeDefined();
    expect(defs.commandDef).toBeDefined();
    expect(defs.flagValue).toBeDefined();
    expect(defs.leveledFlag).toBeDefined();

    const providerConfig = defs.providerConfig as { required?: unknown };

    expect(providerConfig.required).toContain('outputFormat');
  });

  it('GIVEN provider entries WHEN checking commands THEN each provider defines ask', async () => {
    const config = (await readJson(providersJsonUrl)) as ProvidersFile;

    for (const [name, provider] of Object.entries(config.providers)) {
      expect(provider.commands.ask, `${name} must have an "ask" command`).toBeDefined();
    }
  });

  it('GIVEN provider entries WHEN checking top-level metadata THEN each has outputFormat', async () => {
    const config = (await readJson(providersJsonUrl)) as ProvidersFile;

    for (const [name, provider] of Object.entries(config.providers)) {
      expect(provider.outputFormat, `${name} must have "outputFormat" at top level`).toBeDefined();
    }
  });

  it('GIVEN provider name with uppercase WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse({
      configVersion: 1,
      providers: { Claude: validProviderConfig },
    });

    expect(parsed.success).toBe(false);
  });

  it('GIVEN provider name starting with a digit WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse({
      configVersion: 1,
      providers: { '3claude': validProviderConfig },
    });

    expect(parsed.success).toBe(false);
  });

  it('GIVEN provider name with spaces WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse({
      configVersion: 1,
      providers: { 'my agent': validProviderConfig },
    });

    expect(parsed.success).toBe(false);
  });

  it('GIVEN provider name with underscores WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse({
      configVersion: 1,
      providers: { my_agent: validProviderConfig },
    });

    expect(parsed.success).toBe(false);
  });

  it('GIVEN reserved provider name "providers" WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse({
      configVersion: 1,
      providers: { providers: validProviderConfig },
    });

    expect(parsed.success).toBe(false);
  });

  it('GIVEN provider name exceeding 32 chars WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse({
      configVersion: 1,
      providers: { ['a'.repeat(33)]: validProviderConfig },
    });

    expect(parsed.success).toBe(false);
  });

  it('GIVEN valid provider name with hyphens WHEN validating THEN it passes', () => {
    const parsed = providersFileSchema.safeParse({
      configVersion: 1,
      providers: { 'my-custom-agent': validProviderConfig },
    });

    expect(parsed.success).toBe(true);
  });

  it('GIVEN provider entries WHEN checking legacy fields THEN capabilities is absent', async () => {
    const config = (await readJson(providersJsonUrl)) as {
      providers: Record<string, Record<string, unknown>>;
    };

    for (const [name, provider] of Object.entries(config.providers)) {
      expect(provider.capabilities, `${name} must not have a "capabilities" object`).toBeUndefined();
    }
  });
});
