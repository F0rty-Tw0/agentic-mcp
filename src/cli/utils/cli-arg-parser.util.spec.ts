import { describe, expect, it } from 'vitest';

import { parseAskAllArgs, parseAskArgs } from './cli-arg-parser.util';
import { parseReviewArgs } from './review-arg-parser.util';
import { ValidationError } from '../../shared';

describe('parseAskArgs', () => {
  it('GIVEN single positional arg WHEN parsed THEN returns prompt', () => {
    const result = parseAskArgs(['hello']);

    expect(result).toStrictEqual({ prompt: 'hello' });
  });

  it('GIVEN prompt followed by --model WHEN parsed THEN returns prompt and model', () => {
    const result = parseAskArgs(['hello', '--model', 'gpt-4']);

    expect(result).toStrictEqual({ prompt: 'hello', model: 'gpt-4' });
  });

  it('GIVEN --model before positional arg WHEN parsed THEN returns prompt and model', () => {
    const result = parseAskArgs(['--model', 'gpt-4', 'hello']);

    expect(result).toStrictEqual({ prompt: 'hello', model: 'gpt-4' });
  });

  it('GIVEN all supported flags WHEN parsed THEN returns all fields', () => {
    const result = parseAskArgs([
      'prompt',
      '--working-dir',
      '/tmp',
      '--auto-mode',
      'full',
      '--system-prompt',
      'be nice',
      '--effort',
      'high',
      '--max-budget',
      '10',
      '--context',
      'ctx',
    ]);

    expect(result).toStrictEqual({
      prompt: 'prompt',
      working_directory: '/tmp',
      auto_mode: 'full',
      system_prompt: 'be nice',
      effort: 'high',
      max_budget: '10',
      context: 'ctx',
    });
  });

  it('GIVEN repeatable --file flags WHEN parsed THEN collects all file paths', () => {
    const result = parseAskArgs(['prompt', '--file', 'a.ts', '--file', 'b.ts']);

    expect(result).toStrictEqual({ prompt: 'prompt', files: ['a.ts', 'b.ts'] });
  });

  it('GIVEN --async flag WHEN parsed THEN sets mode to async', () => {
    const result = parseAskArgs(['prompt', '--async']);

    expect(result).toStrictEqual({ prompt: 'prompt', mode: 'async' });
  });

  it('GIVEN --job-id flag WHEN parsed THEN sets action to status and job_id', () => {
    const result = parseAskArgs(['--job-id', '123']);

    expect(result).toStrictEqual({ action: 'status', job_id: '123' });
  });

  it('GIVEN --session-id flag WHEN parsed THEN sets session_id', () => {
    const result = parseAskArgs(['prompt', '--session-id', 'sess-1']);

    expect(result).toStrictEqual({ prompt: 'prompt', session_id: 'sess-1' });
  });

  it('GIVEN --config flag WHEN parsed THEN skips it and returns remaining args', () => {
    const result = parseAskArgs(['prompt', '--config', '/path']);

    expect(result).toStrictEqual({ prompt: 'prompt' });
  });

  it('GIVEN --stream-live flag WHEN parsed THEN it maps to stream_live', () => {
    const result = parseAskArgs(['prompt', '--stream-live']);

    expect(result).toStrictEqual({ prompt: 'prompt', stream_live: true });
  });

  it('GIVEN --include-structured flag WHEN parsed THEN it maps to include_structured', () => {
    const result = parseAskArgs(['prompt', '--include-structured']);

    expect(result).toStrictEqual({ prompt: 'prompt', include_structured: true });
  });

  it('GIVEN empty args WHEN parsed THEN returns empty object', () => {
    const result = parseAskArgs([]);

    expect(result).toStrictEqual({});
  });
});

describe('parseAskAllArgs', () => {
  it('GIVEN prompt and --providers WHEN parsed THEN returns prompt and providers array', () => {
    const result = parseAskAllArgs(['prompt', '--providers', 'claude,codex']);

    expect(result).toStrictEqual({ prompt: 'prompt', providers: ['claude', 'codex'] });
  });

  it('GIVEN prompt and spaced --providers values WHEN parsed THEN returns all provider names', () => {
    const result = parseAskAllArgs(['prompt', '--providers', 'claude', 'codex']);

    expect(result).toStrictEqual({ prompt: 'prompt', providers: ['claude', 'codex'] });
  });

  it('GIVEN prompt and quoted space-separated --providers value WHEN parsed THEN returns all provider names', () => {
    const result = parseAskAllArgs(['prompt', '--providers', 'claude gemini']);

    expect(result).toStrictEqual({ prompt: 'prompt', providers: ['claude', 'gemini'] });
  });

  it('GIVEN prompt and --provider alias WHEN parsed THEN returns providers array', () => {
    const result = parseAskAllArgs(['prompt', '--provider', 'claude', 'codex']);

    expect(result).toStrictEqual({ prompt: 'prompt', providers: ['claude', 'codex'] });
  });

  it('GIVEN prompt without --providers WHEN parsed THEN returns prompt with no providers field', () => {
    const result = parseAskAllArgs(['prompt']);

    expect(result).toStrictEqual({ prompt: 'prompt' });
    expect(result).not.toHaveProperty('providers');
  });

  it('GIVEN --model flag WHEN parsed THEN passes through model', () => {
    const result = parseAskAllArgs(['prompt', '--model', 'gpt-4']);

    expect(result).toStrictEqual({ prompt: 'prompt', model: 'gpt-4' });
  });

  it('GIVEN --models alias WHEN parsed THEN returns a model value', () => {
    const result = parseAskAllArgs(['prompt', '--models', 'claude-sonnet-4']);

    expect(result).toStrictEqual({ prompt: 'prompt', model: 'claude-sonnet-4' });
  });

  it('GIVEN quoted multi-word shared model WHEN parsed THEN it preserves spaces in the shared model', () => {
    const result = parseAskAllArgs(['prompt', '--model', 'claude sonnet 4']);

    expect(result).toStrictEqual({ prompt: 'prompt', model: 'claude sonnet 4' });
  });

  it('GIVEN multiple unquoted model values WHEN parsed THEN it throws ValidationError', () => {
    const run = (): void => {
      parseAskAllArgs(['prompt', '--model', 'gemini', 'codex']);
    };

    expect(run).toThrow(ValidationError);
    expect(run).toThrow(
      'ask_all accepts exactly one shared --model value. Use --providers for provider selection or quote the model name.'
    );
  });

  it('GIVEN unknown ask_all flag WHEN parsed THEN throws ValidationError', () => {
    const run = (): void => {
      parseAskAllArgs(['prompt', '--unknown', 'gemini']);
    };

    expect(run).toThrow(ValidationError);
    expect(run).toThrow(
      'Unknown flag "--unknown" for ask_all. Use --providers or --model for supported ask_all options.'
    );
  });

  it('GIVEN --context flag WHEN parsed THEN passes through context', () => {
    const result = parseAskAllArgs(['prompt', '--context', 'some-ctx']);

    expect(result).toStrictEqual({ prompt: 'prompt', context: 'some-ctx' });
  });

  it('GIVEN --working-dir flag WHEN parsed THEN passes through working_directory', () => {
    const result = parseAskAllArgs(['prompt', '--working-dir', '/tmp']);

    expect(result).toStrictEqual({ prompt: 'prompt', working_directory: '/tmp' });
  });

  it('GIVEN --system-prompt flag WHEN parsed THEN passes through system_prompt', () => {
    const result = parseAskAllArgs(['prompt', '--system-prompt', 'be concise']);

    expect(result).toStrictEqual({ prompt: 'prompt', system_prompt: 'be concise' });
  });

  it('GIVEN --stream-live flag WHEN ask_all args are parsed THEN it is ignored because ask_all is non-streaming', () => {
    const result = parseAskAllArgs(['prompt', '--stream-live']);

    expect(result).toStrictEqual({ prompt: 'prompt' });
    expect(result).not.toHaveProperty('stream_live');
  });

  it('GIVEN --include-structured flag WHEN ask_all args are parsed THEN it is ignored', () => {
    const result = parseAskAllArgs(['prompt', '--include-structured']);

    expect(result).toStrictEqual({ prompt: 'prompt' });
    expect(result).not.toHaveProperty('include_structured');
  });

  it('GIVEN empty args WHEN parsed THEN returns empty prompt string', () => {
    const result = parseAskAllArgs([]);

    expect(result).toStrictEqual({ prompt: '' });
  });
});

describe('parseReviewArgs', () => {
  it('GIVEN uncommitted scope with working dir WHEN parsed THEN it returns review args', () => {
    const result = parseReviewArgs(['--scope', 'uncommitted', '--working-dir', '/repo']);

    expect(result).toStrictEqual({ scope: 'uncommitted', working_directory: '/repo', stream_live: true });
  });

  it('GIVEN range scope with base and model WHEN parsed THEN it returns review args', () => {
    const result = parseReviewArgs(['--scope', 'range', '--base', 'origin/main', '--model', 'gpt-5']);

    expect(result).toStrictEqual({ scope: 'range', base: 'origin/main', model: 'gpt-5', stream_live: true });
  });

  it('GIVEN missing --scope WHEN parsed THEN it throws ValidationError', () => {
    const run = (): void => {
      parseReviewArgs(['--working-dir', '/repo']);
    };

    expect(run).toThrow(ValidationError);
    expect(run).toThrow('review commands require --scope');
  });

  it('GIVEN review args without explicit stream flag WHEN parsed THEN it enables stream_live by default', () => {
    const result = parseReviewArgs(['--scope', 'uncommitted']);

    expect(result).toStrictEqual({ scope: 'uncommitted', stream_live: true });
  });
});
