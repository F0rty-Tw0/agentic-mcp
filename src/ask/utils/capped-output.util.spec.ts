import { describe, expect, it } from 'vitest';

import { MAX_RESPONSE_TEXT_BYTES } from '../common';
import { buildCappedOutput } from './capped-output.util';

describe('buildCappedOutput', () => {
  it('GIVEN output within byte limit WHEN building THEN returns original output', () => {
    const input = 'short output';

    const result = buildCappedOutput(input);

    expect(result).toBe(input);
  });

  it('GIVEN empty string WHEN building THEN returns empty string', () => {
    const result = buildCappedOutput('');

    expect(result).toBe('');
  });

  it('GIVEN output exactly at byte limit WHEN building THEN returns original output', () => {
    const input = 'a'.repeat(MAX_RESPONSE_TEXT_BYTES);

    const result = buildCappedOutput(input);

    expect(result).toBe(input);
  });

  it('GIVEN output exceeding byte limit WHEN building THEN truncates and appends notice', () => {
    const input = 'a'.repeat(MAX_RESPONSE_TEXT_BYTES + 100);
    const expectedBytes = Buffer.byteLength(input, 'utf8');

    const result = buildCappedOutput(input);

    expect(result).toContain(`[output truncated — ${expectedBytes} bytes total]`);
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThan(expectedBytes);
  });

  it('GIVEN output exceeding byte limit WHEN building THEN preserves content up to limit', () => {
    const prefix = 'x'.repeat(MAX_RESPONSE_TEXT_BYTES);
    const suffix = 'z'.repeat(100);
    const input = prefix + suffix;

    const result = buildCappedOutput(input);

    expect(result.startsWith(prefix)).toBe(true);
    expect(result).not.toContain('z');
  });

  it('GIVEN multibyte characters exceeding byte limit WHEN building THEN truncates without breaking characters', () => {
    const repeats = Math.ceil(MAX_RESPONSE_TEXT_BYTES / Buffer.byteLength('é', 'utf8'));
    const input = 'é'.repeat(repeats + 50);

    const result = buildCappedOutput(input);

    expect(result).not.toContain('\uFFFD');
    expect(result).toContain('[output truncated');
  });
});
