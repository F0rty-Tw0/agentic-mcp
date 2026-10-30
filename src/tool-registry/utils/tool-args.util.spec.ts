import { describe, expect, it } from 'vitest';

import { isAskAllToolArgs, isReviewToolArgs } from './tool-args.util';

describe('tool args predicates', () => {
  describe('isReviewToolArgs', () => {
    it('GIVEN args with a string scope WHEN checked THEN returns true', () => {
      expect(isReviewToolArgs({ scope: 'uncommitted' })).toBe(true);
    });

    it('GIVEN args without a scope WHEN checked THEN returns false', () => {
      expect(isReviewToolArgs({ commit: 'abc123' })).toBe(false);
    });
  });

  describe('isAskAllToolArgs', () => {
    it('GIVEN args with a string prompt WHEN checked THEN returns true', () => {
      expect(isAskAllToolArgs({ prompt: 'hello' })).toBe(true);
    });

    it('GIVEN args without a prompt WHEN checked THEN returns false', () => {
      expect(isAskAllToolArgs({ providers: ['claude'] })).toBe(false);
    });
  });
});
