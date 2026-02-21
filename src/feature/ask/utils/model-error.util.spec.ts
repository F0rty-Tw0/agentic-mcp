import { describe, expect, it } from 'vitest';

import { buildModelHint, detectModelError } from './model-error.util.ts';

describe('detectModelError', () => {
  it('GIVEN stdout with model-not-found text WHEN detecting THEN returns true', () => {
    const result = detectModelError('Error: model not found', '');

    expect(result).toBe(true);
  });

  it('GIVEN stderr with unknown model text WHEN detecting THEN returns true', () => {
    const result = detectModelError('', 'unknown model: bad-model');

    expect(result).toBe(true);
  });

  it('GIVEN output without model error text WHEN detecting THEN returns false', () => {
    const result = detectModelError('all good', '');

    expect(result).toBe(false);
  });
});

describe('buildModelHint', () => {
  it('GIVEN provider name WHEN building hint THEN includes provider models command', () => {
    const result = buildModelHint('codex');

    expect(result).toContain('Hint:');
    expect(result).toContain('codex models');
  });
});
