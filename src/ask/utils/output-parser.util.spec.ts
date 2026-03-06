import { describe, expect, it } from 'vitest';

import { parseProviderOutput } from './output-parser.util';

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

  it('GIVEN json output with mixed log lines WHEN parsing THEN extracts latest agent message text', () => {
    const output = [
      'Initializing Shell...',
      '{"type":"item.completed","item":{"type":"agent_message","text":"first"}}',
      'Profile loaded successfully.',
      '{"type":"item.completed","item":{"type":"agent_message","text":"final answer"}}',
    ].join('\n');

    const result = parseProviderOutput(output, 'json');

    expect(result.metadata?.outputFormatObserved).toBe('json');
    expect(result.text).toBe('final answer');
  });

  it('GIVEN json output with mixed json events and ansi WHEN parsing THEN strips ansi and keeps structured content', () => {
    const output =
      '\u001b[32m{\"type\":\"item.completed\",\"item\":{\"type\":\"reasoning\",\"text\":\"done\"}}\u001b[39m';

    const result = parseProviderOutput(output, 'json');

    expect(result.metadata?.outputFormatObserved).toBe('json');
    expect(result.text).toContain('"type": "item.completed"');
  });
});
