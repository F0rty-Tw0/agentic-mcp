import { describe, expect, it } from 'vitest';

import { extractParsedText, parseStructuredLine, splitTrimmedLines } from './output-text.util';

describe('FEATURE: provider output text extraction', () => {
  describe('GIVEN an antigravity terminal result event', () => {
    const result = { status: 'SUCCESS', response: 'agy answer' };
    const event = { event: 'result', result };

    it('WHEN extracting the text THEN the nested response is returned', () => {
      const text = extractParsedText(event);

      expect(text).toBe('agy answer');
    });
  });

  describe('GIVEN an antigravity step event', () => {
    const stepUpdate = { step_index: 1, state: 'DONE' };
    const event = { event: 'step_update', step_update: stepUpdate };

    it('WHEN extracting the text THEN nothing is returned', () => {
      const text = extractParsedText(event);

      expect(text).toBeUndefined();
    });
  });

  describe('GIVEN a JSON line', () => {
    it('WHEN it holds an object THEN the object is returned', () => {
      const parsed = parseStructuredLine('{"a":1}');

      expect(parsed).toStrictEqual({ a: 1 });
    });

    it('WHEN it holds a bare number THEN nothing is returned', () => {
      const parsed = parseStructuredLine('42');

      expect(parsed).toBeUndefined();
    });

    it('WHEN it is not JSON THEN nothing is returned', () => {
      const parsed = parseStructuredLine('not-json');

      expect(parsed).toBeUndefined();
    });
  });

  it('GIVEN output with blank and padded lines WHEN splitting THEN only trimmed non-empty lines remain', () => {
    const lines = splitTrimmedLines(' a \n\n b\r\n');

    expect(lines).toStrictEqual(['a', 'b']);
  });
});
