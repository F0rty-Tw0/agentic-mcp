import { describe, expect, it } from 'vitest';

import { buildReviewToolDefinition } from './review-tool.builder';
import type { ProviderConfig } from '../../shared';

const createReviewFlags = (includeModel: boolean): NonNullable<ProviderConfig['commands']['review']>['flags'] => {
  const reviewFlags: NonNullable<ProviderConfig['commands']['review']>['flags'] = {
    uncommitted: ['--uncommitted'],
    base: '--base',
    commit: '--commit',
  };

  if (includeModel) {
    reviewFlags.model = '-m';
  }

  return reviewFlags;
};

const createConfig = (includeModel = true): ProviderConfig => {
  const ask = { args: ['exec'] };
  const review = {
    args: ['review'],
    flags: createReviewFlags(includeModel),
  };
  const commands = {
    ask,
    review,
  };
  const input: ProviderConfig['input'] = { method: 'positional' };
  const providerConfig: ProviderConfig = {
    enabled: true,
    description: 'Codex review config',
    command: 'codex',
    timeout: 120_000,
    env: {},
    outputFormat: 'json',
    commands,
    input,
  };

  return providerConfig;
};

describe('buildReviewToolDefinition', () => {
  it('GIVEN review-enabled provider WHEN building definition THEN it uses the review_{provider} name and description', () => {
    const config = createConfig();

    const result = buildReviewToolDefinition('codex', config);

    expect(result.name).toBe('review_codex');
    expect(result.description).toContain('codex');
    expect(result.annotations).toStrictEqual({ readOnlyHint: true, openWorldHint: true });
  });

  it('GIVEN codex review command WHEN building definition THEN schema includes scope and git reference fields', () => {
    const definition = buildReviewToolDefinition('codex', createConfig());
    const scopeSchema = definition.inputSchema?.scope;

    expect(scopeSchema).toBeDefined();

    if (!scopeSchema) throw new Error('Expected review scope schema to exist');

    expect(scopeSchema.parse('uncommitted')).toBe('uncommitted');
    expect(scopeSchema.parse('commit')).toBe('commit');
    expect(scopeSchema.parse('range')).toBe('range');
    expect(definition.inputSchema).toHaveProperty('commit');
    expect(definition.inputSchema).toHaveProperty('base');
    expect(definition.inputSchema).toHaveProperty('model');
    expect(definition.inputSchema).toHaveProperty('include_structured');
    expect(definition.inputSchema).toHaveProperty('stream_live');
  });

  it('GIVEN review command with workingDir flag WHEN building definition THEN working_directory is present', () => {
    const baseConfig = createConfig();
    const baseReview = baseConfig.commands.review;

    if (!baseReview?.flags) throw new Error('Expected review flags to exist');

    const flags = {
      ...baseReview.flags,
      workingDir: '-C',
    };
    const review = {
      ...baseReview,
      flags,
    };
    const commands = {
      ...baseConfig.commands,
      review,
    };
    const config: ProviderConfig = {
      ...baseConfig,
      commands,
    };

    const result = buildReviewToolDefinition('codex', config);

    expect(result.inputSchema).toHaveProperty('working_directory');
  });

  it('GIVEN review command without model flag WHEN building definition THEN model is omitted from schema', () => {
    const config = createConfig(false);

    const result = buildReviewToolDefinition('codex', config);

    expect(result.inputSchema).not.toHaveProperty('model');
  });
});
