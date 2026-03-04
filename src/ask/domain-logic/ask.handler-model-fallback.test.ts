/**
 * Integration test — exercises model fallback retry behavior end-to-end.
 * When a provider's default model fails and no user model was specified,
 * the system fetches available models and retries with the first one.
 *
 * No mocks, no stubs. Uses real child processes via handleAsk.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 */

import { describe, expect, it } from 'vitest';

import { handleAsk } from './ask.handler';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared';

const MODEL_FALLBACK_SCRIPT = `
  const args = process.argv.slice(2);
  const modelIndex = args.indexOf('-m');
  if (modelIndex === -1 || !args[modelIndex + 1]) {
    process.stdout.write('Model not found: bad-default-model.');
    process.exit(1);
  }
  const model = args[modelIndex + 1];
  process.stdout.write(JSON.stringify({ result: 'success', model }));
  process.exit(0);
`;

const MODELS_LIST_SCRIPT = `
  process.stdout.write('test-provider/model-alpha\\ntest-provider/model-beta\\n');
  process.exit(0);
`;

const createFallbackContext = (): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    enabled: true,
    description: 'Node model-fallback test provider',
    command: process.execPath,
    timeout: 15_000,
    env: {},
    outputFormat: 'json',
    commands: {
      ask: {
        args: ['-e', MODEL_FALLBACK_SCRIPT],
        flags: {
          model: '-m',
        },
      },
      models: {
        args: ['-e', MODELS_LIST_SCRIPT],
      },
    },
    input: { method: 'positional' },
  };

  const context: ResolvedProviderEntry = {
    name: 'node-fallback',
    binaryPath: process.execPath,
    config,
  };

  return context;
};

const createFallbackContextWithoutModelsCommand = (): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    enabled: true,
    description: 'Node model-fallback test provider (no models command)',
    command: process.execPath,
    timeout: 15_000,
    env: {},
    outputFormat: 'json',
    commands: {
      ask: {
        args: ['-e', MODEL_FALLBACK_SCRIPT],
        flags: {
          model: '-m',
        },
      },
    },
    input: { method: 'positional' },
  };

  const context: ResolvedProviderEntry = {
    name: 'node-fallback-no-models',
    binaryPath: process.execPath,
    config,
  };

  return context;
};

describe('integration: model fallback retry', () => {
  it('GIVEN provider with bad default model and models command WHEN ask is called without model THEN retries with first available model and succeeds', async () => {
    const context = createFallbackContext();

    const result = await handleAsk(context, { prompt: 'test-prompt' });

    expect(result.isError).not.toBe(true);

    const { text } = result.content[0] as { type: 'text'; text: string };

    expect(text).toContain('model-alpha');
    expect(text).toContain('success');
  });

  it('GIVEN provider with explicit model WHEN ask is called THEN uses the specified model directly without fallback', async () => {
    const context = createFallbackContext();

    const result = await handleAsk(context, { prompt: 'test-prompt', model: 'explicit-model' });

    expect(result.isError).not.toBe(true);

    const text = (result.content[0] as { type: 'text'; text: string }).text;

    expect(text).toContain('explicit-model');
  });

  it('GIVEN provider with bad default model but no models command WHEN ask is called without model THEN fails with model error hint', async () => {
    const context = createFallbackContextWithoutModelsCommand();

    const result = await handleAsk(context, { prompt: 'test-prompt' });

    expect(result.isError).toBe(true);

    const { text } = result.content[0] as { type: 'text'; text: string };

    expect(text).toContain('Model error');
  });
});
