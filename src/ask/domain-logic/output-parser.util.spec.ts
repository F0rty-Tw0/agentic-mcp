import { describe, expect, it } from 'vitest';

import { parseProviderOutput } from './output-parser.util.ts';

describe('parseProviderOutput', () => {
  it('GIVEN valid JSON WHEN parsing THEN returns parsed metadata and text', () => {
    const result = parseProviderOutput('{"ok":true}', 'json');

    expect(result.metadata?.outputFormatObserved).toBe('json');
    expect(result.text).toContain('"ok": true');
  });

  it('GIVEN malformed JSON WHEN parsing THEN falls back to raw text', () => {
    const result = parseProviderOutput('not-json', 'json');

    expect(result.text).toBe('not-json');
    expect(result.metadata).toBeUndefined();
  });

  it('GIVEN valid NDJSON WHEN parsing THEN returns stream-json metadata', () => {
    const result = parseProviderOutput('{"a":1}\n{"b":2}', 'stream-json');

    expect(result.metadata?.outputFormatObserved).toBe('stream-json');
    expect(result.text).toContain('"a": 1');
    expect(result.text).toContain('"b": 2');
  });
});
