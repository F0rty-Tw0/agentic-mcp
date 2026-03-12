import fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providersFileSchema } from '../shared';
import type { ProvidersFile } from '../shared';

const providersJsonUrl = new URL('./providers.json', import.meta.url);

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

const readBundledProviders = async (): Promise<Providers> => {
  const config = (await readJson(providersJsonUrl)) as ProvidersFile;

  return config.providers;
};

const getRequiredProvider = (providers: Providers, providerName: string): Providers[string] => {
  const provider = providers[providerName];

  if (provider == null) {
    throw new Error(`Expected provider "${providerName}" to exist in bundled config`);
  }

  return provider;
};

const getRequiredAskCommand = (provider: Providers[string]): NonNullable<Providers[string]['commands']['ask']> => {
  const askCommand = provider.commands.ask;

  if (askCommand == null) {
    throw new Error(`Expected provider "${provider.command}" to declare an ask command`);
  }

  return askCommand;
};

const getRequiredAskFlags = (
  provider: Providers[string]
): NonNullable<Providers[string]['commands']['ask']['flags']> => {
  const { flags } = getRequiredAskCommand(provider);

  if (flags == null) {
    throw new Error(`Expected provider "${provider.command}" to declare ask flags`);
  }

  const askFlags = flags as NonNullable<Providers[string]['commands']['ask']['flags']>;

  return askFlags;
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

  it('GIVEN provider config with stable supportLevel WHEN validating THEN it passes', () => {
    const parsed = providersFileSchema.safeParse(
      buildProvidersConfig({ ...validProviderConfig, supportLevel: 'stable' })
    );

    expect(parsed.success).toBe(true);
  });

  it('GIVEN provider config with beta supportLevel WHEN validating THEN it passes', () => {
    const parsed = providersFileSchema.safeParse(
      buildProvidersConfig({ ...validProviderConfig, supportLevel: 'beta' })
    );

    expect(parsed.success).toBe(true);
  });

  it('GIVEN provider config with experimental supportLevel WHEN validating THEN it passes', () => {
    const parsed = providersFileSchema.safeParse(
      buildProvidersConfig({ ...validProviderConfig, supportLevel: 'experimental' })
    );

    expect(parsed.success).toBe(true);
  });

  it('GIVEN provider config with community supportLevel WHEN validating THEN it passes', () => {
    const parsed = providersFileSchema.safeParse(
      buildProvidersConfig({ ...validProviderConfig, supportLevel: 'community' })
    );

    expect(parsed.success).toBe(true);
  });

  it('GIVEN provider config with invalid supportLevel WHEN validating THEN it fails', () => {
    const parsed = providersFileSchema.safeParse(
      buildProvidersConfig({ ...validProviderConfig, supportLevel: 'unsupported' })
    );

    expect(parsed.success).toBe(false);
  });

  it('GIVEN bundled providers config WHEN checking supportLevel THEN each provider declares it', async () => {
    const providers = await readBundledProviders();

    for (const [name, provider] of Object.entries(providers)) {
      expect(provider.supportLevel, `${name} must have "supportLevel"`).toBeDefined();
    }
  });

  it('GIVEN bundled providers config WHEN checking aider THEN it declares the scripted one shot shape', async () => {
    const providers = await readBundledProviders();
    const aider = getRequiredProvider(providers, 'aider');

    const aiderAsk = getRequiredAskCommand(aider);

    expect(aider.supportLevel).toBe('community');
    expect(aider.outputFormat).toBe('text');
    expect(aider.input.method).toBe('flag');
    expect(aiderAsk.args).toStrictEqual(['--message']);
    expect(aiderAsk.flags?.model).toBe('--model');
  });

  it('GIVEN bundled providers config WHEN checking goose THEN it declares json run flags and sessions support', async () => {
    const providers = await readBundledProviders();
    const goose = getRequiredProvider(providers, 'goose');

    const gooseAsk = getRequiredAskCommand(goose);

    expect(goose.supportLevel).toBe('beta');
    expect(goose.outputFormat).toBe('json');
    expect(goose.input.method).toBe('flag');
    expect(gooseAsk.args).toStrictEqual(['run', '--text']);
    expect(gooseAsk.trailingArgs).toStrictEqual(['--no-session', '--output-format', 'json']);
    expect(goose.commands.sessions?.args).toStrictEqual(['session', 'list', '--format', 'json']);
  });

  it('GIVEN bundled providers config WHEN checking amp THEN it declares stdin execute mode with stream-json output', async () => {
    const providers = await readBundledProviders();
    const amp = getRequiredProvider(providers, 'amp');

    const ampAsk = getRequiredAskCommand(amp);

    expect(amp.supportLevel).toBe('beta');
    expect(amp.outputFormat).toBe('stream-json');
    expect(amp.input.method).toBe('stdin');
    expect(ampAsk.args).toStrictEqual(['--execute']);
    expect(ampAsk.trailingArgs).toStrictEqual(['--stream-json']);
    expect(ampAsk.flags?.autoMode).toStrictEqual(['--dangerously-allow-all']);
  });

  it('GIVEN bundled providers config WHEN checking cline THEN it declares positional headless json output', async () => {
    const providers = await readBundledProviders();
    const cline = getRequiredProvider(providers, 'cline');

    const clineAsk = getRequiredAskCommand(cline);

    expect(cline.supportLevel).toBe('beta');
    expect(cline.outputFormat).toBe('stream-json');
    expect(cline.input.method).toBe('positional');
    expect(clineAsk.args).toStrictEqual(['-y']);
    expect(clineAsk.trailingArgs).toStrictEqual(['--json']);
  });

  it('GIVEN bundled providers config WHEN checking cursor THEN it declares print mode with model, workspace, and sandbox flags', async () => {
    const providers = await readBundledProviders();
    const cursor = getRequiredProvider(providers, 'cursor');
    const cursorFlags = getRequiredAskFlags(cursor);

    const cursorAsk = getRequiredAskCommand(cursor);

    expect(cursor.supportLevel).toBe('beta');
    expect(cursor.outputFormat).toBe('json');
    expect(cursor.input.method).toBe('flag');
    expect(cursorAsk.args).toStrictEqual(['-p']);
    expect(cursorFlags.model).toBe('--model');
    expect(cursorFlags.workingDir).toBe('--workspace');
    expect(cursorFlags.sandbox).toStrictEqual({
      flag: '--sandbox',
      values: ['enabled', 'disabled'],
    });
  });

  it('GIVEN bundled providers config WHEN checking droid THEN it declares exec json mode with model and cwd flags', async () => {
    const providers = await readBundledProviders();
    const droid = getRequiredProvider(providers, 'droid');

    const droidAsk = getRequiredAskCommand(droid);

    expect(droid.supportLevel).toBe('beta');
    expect(droid.outputFormat).toBe('json');
    expect(droid.input.method).toBe('positional');
    expect(droidAsk.args).toStrictEqual(['exec']);
    expect(droidAsk.trailingArgs).toStrictEqual(['--output-format', 'json']);
    expect(droidAsk.flags?.model).toBe('-m');
    expect(droidAsk.flags?.workingDir).toBe('--cwd');
  });

  it('GIVEN bundled wave 3c provider templates WHEN checking metadata THEN they stay disabled with support and prerequisites', async () => {
    const providers = await readBundledProviders();
    const wave3cProviders = ['amazon-q', 'plandex', 'openhands', 'qwen-code', 'tabnine'] as const;

    for (const providerName of wave3cProviders) {
      const provider = getRequiredProvider(providers, providerName);

      expect(provider.enabled, `${providerName} must stay disabled by default`).toBe(false);
      expect(['experimental', 'community']).toContain(provider.supportLevel);
      expect(provider.prerequisites?.length, `${providerName} must declare prerequisites`).toBeGreaterThan(0);
    }
  });

  it('GIVEN bundled codex provider WHEN checking review command THEN it declares workingDir support', async () => {
    const providers = await readBundledProviders();
    const codex = getRequiredProvider(providers, 'codex');
    const codexReview = codex.commands.review;

    expect(codexReview).toBeDefined();
    expect(codexReview?.flags?.workingDir).toBe('-C');
  });
});
