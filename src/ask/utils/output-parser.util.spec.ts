import { describe, expect, it } from 'vitest';

import { parseProviderOutput } from './output-parser.util';

describe('parseProviderOutput', () => {
  it('GIVEN valid JSON WHEN parsing THEN returns parsed metadata and text', () => {
    const result = parseProviderOutput('{"ok":true}', 'json');

    expect(result.metadata?.outputFormatObserved).toBe('json');
    expect(result.text).toContain('"ok": true');
  });

  it('GIVEN JSON string WHEN parsing THEN returns string text with json metadata', () => {
    const result = parseProviderOutput('"hello world"', 'json');

    expect(result.metadata?.outputFormatObserved).toBe('json');
    expect(result.text).toBe('hello world');
    expect(result.metadata?.parsed).toBe('hello world');
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

  it('GIVEN empty NDJSON WHEN parsing THEN returns empty text without metadata', () => {
    const result = parseProviderOutput('  \n\n  ', 'stream-json');

    expect(result.text).toBe('');
    expect(result.metadata).toBeUndefined();
  });

  it('GIVEN malformed NDJSON line WHEN parsing THEN returns raw stdout', () => {
    const output = '{"a":1}\nnot-json';

    const result = parseProviderOutput(output, 'stream-json');

    expect(result.text).toBe(output);
    expect(result.metadata).toBeUndefined();
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
    const output = '\u001b[32m{"type":"item.completed","item":{"type":"reasoning","text":"done"}}\u001b[39m';

    const result = parseProviderOutput(output, 'json');

    expect(result.metadata?.outputFormatObserved).toBe('json');
    expect(result.text).toContain('"type": "item.completed"');
  });

  it('GIVEN mixed JSON lines without agent messages WHEN parsing THEN returns pretty-printed parsed lines', () => {
    const output = ['starting...', '{"type":"item.started"}', '{"type":"item.completed"}', 'done'].join('\n');

    const result = parseProviderOutput(output, 'json');

    expect(result.metadata?.outputFormatObserved).toBe('json');
    expect(result.text).toContain('"type": "item.started"');
    expect(result.text).toContain('"type": "item.completed"');
  });

  it('GIVEN text output with ansi WHEN parsing THEN strips ansi and marks text format metadata', () => {
    const result = parseProviderOutput('\u001b[33mplain text\u001b[39m', 'text');

    expect(result.text).toBe('plain text');
    expect(result.metadata?.outputFormatObserved).toBe('text');
  });
});
