import fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providersFileSchema } from '../shared';
import type { CommandDef, ProviderConfig } from '../shared';

type JsonRecord = Readonly<Record<string, unknown>>;

const PROVIDERS_SCHEMA_URL = new URL('./providers.schema.json', import.meta.url);
const PROVIDERS_JSON_URL = new URL('./providers.json', import.meta.url);
const START_WITH_ID_SCHEMA_PATH: string[] = ['$defs', 'commandDef', 'properties', 'flags', 'properties', 'startWithId'];

const isJsonRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null;

const readChild = (node: unknown, key: string): unknown => (isJsonRecord(node) ? node[key] : undefined);

const readStartWithIdDescription = async (): Promise<unknown> => {
  const content = await fs.readFile(PROVIDERS_SCHEMA_URL, 'utf8');
  const parsedJson: unknown = JSON.parse(content);
  const startWithId = START_WITH_ID_SCHEMA_PATH.reduce(readChild, parsedJson);
  const description = readChild(startWithId, 'description');

  return description;
};

const buildProvidersInput = (startWithId: unknown): unknown => {
  const flags = { startWithId };
  const sessions = { flags };
  const ask: CommandDef = { args: ['run'] };
  const input: ProviderConfig['input'] = { method: 'positional' };
  const commands = { ask, sessions };
  const provider = {
    enabled: true,
    description: 'Example provider',
    command: 'example-cli',
    timeout: 120000,
    env: {},
    outputFormat: 'text',
    commands,
    input,
  };
  const providers = { example: provider };
  const result = { configVersion: 1, providers };

  return result;
};

const parseStartWithId = (startWithId: unknown): boolean => {
  const providersInput = buildProvidersInput(startWithId);
  const parsed = providersFileSchema.safeParse(providersInput);

  return parsed.success;
};

const readBundledCopilotStartFlag = async (): Promise<CommandDef['flags']> => {
  const content = await fs.readFile(PROVIDERS_JSON_URL, 'utf8');
  const parsedJson: unknown = JSON.parse(content);
  const copilot = providersFileSchema.parse(parsedJson).providers.copilot;
  const flags = copilot?.commands.sessions?.flags;

  return flags;
};

describe('FEATURE: sessions startWithId flag', () => {
  describe('GIVEN providers.schema.json', () => {
    it('WHEN reading the command flags THEN startWithId is documented', async () => {
      const description = await readStartWithIdDescription();

      expect(description).toContain('--session-id=');
    });
  });

  describe('GIVEN the Zod providers schema', () => {
    it('WHEN startWithId is a value flag ending in "=" THEN the config is accepted', () => {
      const isValid = parseStartWithId('--session-id=');

      expect(isValid).toBe(true);
    });

    it('WHEN startWithId is an args array THEN the config is accepted', () => {
      const isValid = parseStartWithId(['--new-session']);

      expect(isValid).toBe(true);
    });

    it('WHEN startWithId is null THEN the config is rejected', () => {
      const isValid = parseStartWithId(null);

      expect(isValid).toBe(false);
    });

    it('WHEN startWithId is a leveled flag THEN the config is rejected', () => {
      const leveledFlag = { flag: '--session-id', values: ['a'] };

      const isValid = parseStartWithId(leveledFlag);

      expect(isValid).toBe(false);
    });

    it('WHEN startWithId is an empty string THEN the config is rejected', () => {
      const isValid = parseStartWithId('');

      expect(isValid).toBe(false);
    });
  });

  it('GIVEN the bundled providers.json WHEN reading copilot sessions flags THEN copilot starts sessions with --session-id=', async () => {
    const flags = await readBundledCopilotStartFlag();

    expect(flags?.startWithId).toBe('--session-id=');
  });
});
