import { describe, expect, it } from 'vitest';

import { stripAnsi } from './platform.util';

describe('platform utilities', () => {
  describe('stripAnsi', () => {
    it('GIVEN ANSI-colored output WHEN stripping ANSI THEN only visible text remains', () => {
      expect(stripAnsi('\u001B[31merror\u001B[39m')).toBe('error');
    });

    it('GIVEN plain string WHEN stripping ANSI THEN returns unchanged', () => {
      expect(stripAnsi('plain')).toBe('plain');
    });

    it('GIVEN empty string WHEN stripping ANSI THEN returns empty string', () => {
      expect(stripAnsi('')).toBe('');
    });
  });
});
