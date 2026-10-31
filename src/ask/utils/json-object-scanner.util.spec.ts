import { describe, expect, it } from 'vitest';

import { createJsonObjectScanner } from './json-object-scanner.util';

describe('FEATURE: json object scanner', () => {
  describe('GIVEN a fresh scanner', () => {
    it('WHEN a whole object arrives in one chunk THEN it reports a closed object', () => {
      const closesObject = createJsonObjectScanner();

      const closed = closesObject('{"response":"answer"}');

      expect(closed).toBe(true);
    });

    it('WHEN only a nested object closes THEN it reports no closed object', () => {
      const closesObject = createJsonObjectScanner();

      const closed = closesObject('{"usage":{"total_tokens":1}');

      expect(closed).toBe(false);
    });

    it('WHEN a string holds a closing brace THEN it reports no closed object', () => {
      const closesObject = createJsonObjectScanner();

      const closed = closesObject('{"response":"a } b');

      expect(closed).toBe(false);
    });

    it('WHEN a string holds an escaped quote before a brace THEN it reports no closed object', () => {
      const closesObject = createJsonObjectScanner();

      const closed = closesObject(String.raw`{"response":"say \"}\" now`);

      expect(closed).toBe(false);
    });

    it('WHEN text before the object holds a quote THEN the object still closes', () => {
      const closesObject = createJsonObjectScanner();

      const closed = closesObject('it\'s "starting\n{"response":"answer"}');

      expect(closed).toBe(true);
    });
  });

  it('GIVEN an object split across chunks WHEN the last chunk closes it THEN only that chunk reports a closed object', () => {
    const closesObject = createJsonObjectScanner();

    const firstClosed = closesObject('{"response":"ans');
    const lastClosed = closesObject('wer"}');

    expect([firstClosed, lastClosed]).toStrictEqual([false, true]);
  });
});
