import fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providersFileSchema } from '../shared';
import type { CommandDef, ProviderConfig, ProvidersFile } from '../shared';

const providersJsonUrl = new URL('./providers.json', import.meta.url);
const providersSchemaUrl = new URL('./providers.schema.json', import.meta.url);

type JsonRecord = Readonly<Record<string, unknown>>;
type JsonRecordMap = Readonly<Record<string, JsonRecord>>;

type RequiredDescriptor = {
  readonly required?: unknown;
};

type LegacyProvidersFile = {
  readonly providers: JsonRecordMap;
};

const validAskCommand: CommandDef = { args: ['run'] };
const validCommands: ProviderConfig['commands'] = { ask: validAskCommand };
const validInput: ProviderConfig['input'] = { method: 'positional' };

const validProviderConfig: ProviderConfig = {
  enabled: true,
  description: 'Example provider config for schema tests',
  command: 'example-cli',
  timeout: 120000,
  env: {},
  outputFormat: 'json',
  commands: validCommands,
  input: validInput,
};

const buildProvidersInput = (providerName: string): unknown => {
  const providers = { [providerName]: validProviderConfig };
  const providersInput = { configVersion: 1, providers };

  return providersInput;
};

const readJson = async (url: URL): Promise<unknown> => {
  const content = await fs.readFile(url, 'utf8');

  return JSON.parse(content);
};

describe('providers schema tail checks', () => {
  it('GIVEN providers.schema.json WHEN reading descriptors THEN required keys are present', async () => {
    const schema = (await readJson(providersSchemaUrl)) as JsonRecord;

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');

    const properties = schema.properties as JsonRecord;
    const defs = schema.$defs as JsonRecord;

    expect(properties.providers).toBeDefined();
    expect(defs.providerConfig).toBeDefined();
    expect(defs.commandDef).toBeDefined();
    expect(defs.flagValue).toBeDefined();
    expect(defs.leveledFlag).toBeDefined();

    const providerConfig = defs.providerConfig as RequiredDescriptor;

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
    const parsed = providersFileSchema.safeParse(buildProvidersInput('Claude'));

    expect(parsed.success).toBe(false);
  });

  it('GIVEN provider name starting with a digit WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse(buildProvidersInput('3claude'));

    expect(parsed.success).toBe(false);
  });

  it('GIVEN provider name with spaces WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse(buildProvidersInput('my agent'));

    expect(parsed.success).toBe(false);
  });

  it('GIVEN provider name with underscores WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse(buildProvidersInput('my_agent'));

    expect(parsed.success).toBe(false);
  });

  it('GIVEN reserved provider name "providers" WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse(buildProvidersInput('providers'));

    expect(parsed.success).toBe(false);
  });

  it('GIVEN provider name exceeding 32 chars WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse(buildProvidersInput('a'.repeat(33)));

    expect(parsed.success).toBe(false);
  });

  it('GIVEN valid provider name with hyphens WHEN validating THEN it passes', () => {
    const parsed = providersFileSchema.safeParse(buildProvidersInput('my-custom-agent'));

    expect(parsed.success).toBe(true);
  });

  it('GIVEN provider entries WHEN checking legacy fields THEN capabilities is absent', async () => {
    const config = (await readJson(providersJsonUrl)) as LegacyProvidersFile;

    for (const [name, provider] of Object.entries(config.providers)) {
      expect(provider.capabilities, `${name} must not have a "capabilities" object`).toBeUndefined();
    }
  });
});
