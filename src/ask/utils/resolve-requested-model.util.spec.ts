import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveRequestedModel } from './resolve-requested-model.util';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared';
import { TEST_MINIMAL_ENV_STUB } from '../../shared';
import type { AskToolArgs } from '../common';
import * as modelErrorUtil from '../../shared/provider/utils/model-error.util';

const buildProviderConfig = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => {
  const providerConfig: ProviderConfig = {
    enabled: true,
    description: 'test provider',
    command: 'test-cli',
    timeout: 30_000,
    env: {},
    outputFormat: 'text',
    commands: {
      ask: { args: [] },
    },
    input: { method: 'positional' },
    ...overrides,
  };

  return providerConfig;
};

const buildContext = (overrides: Partial<ResolvedProviderEntry> = {}): ResolvedProviderEntry => {
  const context: ResolvedProviderEntry = {
    name: 'test-provider',
    binaryPath: '/usr/bin/test',
    config: buildProviderConfig(),
    ...overrides,
  };

  return context;
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('resolveRequestedModel', () => {
  it('GIVEN args without model WHEN called THEN returns args unchanged without fetching models', async () => {
    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello' };

    const fetchAvailableModelsSpy = vi.spyOn(modelErrorUtil, 'fetchAvailableModels');
    const result = await resolveRequestedModel({ context, args, env: TEST_MINIMAL_ENV_STUB });

    expect(result).toStrictEqual(args);
    expect(fetchAvailableModelsSpy).not.toHaveBeenCalled();
  });

  it('GIVEN valid model identifier WHEN called THEN returns args unchanged without fetching models', async () => {
    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello', model: 'openai/gpt-5.4' };

    const fetchAvailableModelsSpy = vi.spyOn(modelErrorUtil, 'fetchAvailableModels');
    const result = await resolveRequestedModel({ context, args, env: TEST_MINIMAL_ENV_STUB });

    expect(result).toStrictEqual(args);
    expect(fetchAvailableModelsSpy).not.toHaveBeenCalled();
  });

  it('GIVEN friendly codex model label WHEN called THEN returns args with closest codex model', async () => {
    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello', model: 'codex 5.4' };
    const availableModels = 'openai/gpt-5.4\nopenai/gpt-5.3-codex';

    const fetchAvailableModelsSpy = vi.spyOn(modelErrorUtil, 'fetchAvailableModels').mockResolvedValue(availableModels);

    const result = await resolveRequestedModel({ context, args, env: TEST_MINIMAL_ENV_STUB });

    expect(fetchAvailableModelsSpy).toHaveBeenCalledWith(context, TEST_MINIMAL_ENV_STUB, expect.any(Function));
    expect(result.model).toBe('openai/gpt-5.4');
  });

  it('GIVEN friendly gemini model label WHEN called THEN returns args with closest gemini model', async () => {
    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello', model: 'gemini 2.5 pro' };
    const availableModels = 'google/gemini-2.5-pro\ngoogle/gemini-2.5-flash';

    vi.spyOn(modelErrorUtil, 'fetchAvailableModels').mockResolvedValue(availableModels);

    const result = await resolveRequestedModel({ context, args, env: TEST_MINIMAL_ENV_STUB });

    expect(result.model).toBe('google/gemini-2.5-pro');
  });

  it('GIVEN friendly claude model label WHEN called THEN returns args with closest claude model', async () => {
    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello', model: 'claude sonnet 4.6' };
    const availableModels = 'claude-sonnet-4.6\nclaude-opus-4.6';

    vi.spyOn(modelErrorUtil, 'fetchAvailableModels').mockResolvedValue(availableModels);

    const result = await resolveRequestedModel({ context, args, env: TEST_MINIMAL_ENV_STUB });

    expect(result.model).toBe('claude-sonnet-4.6');
  });

  it('GIVEN no close model match WHEN called THEN returns args unchanged', async () => {
    const context = buildContext();
    const args: AskToolArgs = { prompt: 'hello', model: 'llama 4' };
    const availableModels = 'google/gemini-2.5-pro\nclaude-sonnet-4.6';

    vi.spyOn(modelErrorUtil, 'fetchAvailableModels').mockResolvedValue(availableModels);

    const result = await resolveRequestedModel({ context, args, env: TEST_MINIMAL_ENV_STUB });

    expect(result).toStrictEqual(args);
  });
});
