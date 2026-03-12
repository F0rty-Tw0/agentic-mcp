import { describe, expect, it } from 'vitest';

import { buildReviewArgArray } from './arg.builder';
import type { ProviderConfig } from '../../shared';
import { ValidationError } from '../../shared';

const createConfig = (): ProviderConfig => ({
  enabled: true,
  description: 'Codex review config',
  command: 'codex',
  timeout: 120_000,
  env: {},
  outputFormat: 'json',
  commands: {
    ask: { args: ['exec'] },
    review: {
      args: ['review'],
      flags: {
        uncommitted: ['--uncommitted'],
        base: '--base',
        commit: '--commit',
        model: '-m',
      },
    },
  },
  input: { method: 'positional' },
});

describe('buildReviewArgArray', () => {
  it('GIVEN uncommitted scope WHEN building args THEN it appends the provider uncommitted flag', () => {
    const config = createConfig();

    const result = buildReviewArgArray(config, { scope: 'uncommitted' });

    expect(result.args).toStrictEqual(['review', '--uncommitted']);
    expect(result.stdinInput).toBeUndefined();
    expect(result.outputFormat).toBe('json');
  });

  it('GIVEN commit scope WHEN building args THEN it appends the commit flag and value', () => {
    const config = createConfig();

    const result = buildReviewArgArray(config, { scope: 'commit', commit: 'abc123' });

    expect(result.args).toStrictEqual(['review', '--commit', 'abc123']);
  });

  it('GIVEN range scope with model WHEN building args THEN it prepends global flags before the review subcommand', () => {
    const config = createConfig();

    const result = buildReviewArgArray(config, { scope: 'range', base: 'origin/main', model: 'gpt-5' });

    expect(result.args).toStrictEqual(['-m', 'gpt-5', 'review', '--base', 'origin/main']);
  });

  it('GIVEN working_directory for review WHEN building args THEN it prepends the working directory flag before the review subcommand', () => {
    const baseConfig = createConfig();
    const baseReview = baseConfig.commands.review;

    if (!baseReview?.flags) {
      throw new Error('Expected review flags to exist');
    }

    const config: ProviderConfig = {
      ...baseConfig,
      commands: {
        ...baseConfig.commands,
        review: {
          ...baseReview,
          flags: {
            ...baseReview.flags,
            workingDir: '-C',
          },
        },
      },
    };

    const result = buildReviewArgArray(config, { scope: 'uncommitted', working_directory: '/repo' });

    expect(result.args).toStrictEqual(['-C', '/repo', 'review', '--uncommitted']);
  });

  it('GIVEN commit scope without commit WHEN building args THEN it throws ValidationError', () => {
    const config = createConfig();

    expect(() => buildReviewArgArray(config, { scope: 'commit' })).toThrow(ValidationError);
    expect(() => buildReviewArgArray(config, { scope: 'commit' })).toThrow('commit is required');
  });

  it('GIVEN range scope without base WHEN building args THEN it throws ValidationError', () => {
    const config = createConfig();

    expect(() => buildReviewArgArray(config, { scope: 'range' })).toThrow(ValidationError);
    expect(() => buildReviewArgArray(config, { scope: 'range' })).toThrow('base is required');
  });
});
