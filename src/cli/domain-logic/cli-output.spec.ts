import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extractResultText, printResult } from './cli-output';

describe('extractResultText', () => {
  it('GIVEN single text content WHEN extracted THEN returns text string', () => {
    const result = extractResultText({ content: [{ type: 'text', text: 'hello' }] });

    expect(result).toBe('hello');
  });

  it('GIVEN multiple text contents WHEN extracted THEN joins with newline', () => {
    const result = extractResultText({
      content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ],
    });

    expect(result).toBe('first\nsecond');
  });

  it('GIVEN non-text content only WHEN extracted THEN returns empty string', () => {
    const result = extractResultText({
      content: [{ type: 'image', data: '...', mimeType: 'image/png' }],
    });

    expect(result).toBe('');
  });

  it('GIVEN mixed text and non-text content WHEN extracted THEN returns only text parts', () => {
    const result = extractResultText({
      content: [
        { type: 'text', text: 'hello' },
        { type: 'image', data: '...', mimeType: 'image/png' },
        { type: 'text', text: 'world' },
      ],
    });

    expect(result).toBe('hello\nworld');
  });
});

describe('printResult', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = undefined;
  });

  it('GIVEN successful result WHEN printed THEN writes to stdout', () => {
    printResult({ content: [{ type: 'text', text: 'hello' }] });

    expect(stdoutSpy).toHaveBeenCalledWith('hello\n');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('GIVEN successful result WHEN printed THEN does not set exitCode', () => {
    printResult({ content: [{ type: 'text', text: 'hello' }] });

    expect(process.exitCode).toBeUndefined();
  });

  it('GIVEN error result WHEN printed THEN writes to stderr', () => {
    printResult({ content: [{ type: 'text', text: 'oops' }], isError: true });

    expect(stderrSpy).toHaveBeenCalledWith('oops\n');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('GIVEN error result WHEN printed THEN sets exitCode to 1', () => {
    printResult({ content: [{ type: 'text', text: 'oops' }], isError: true });

    expect(process.exitCode).toBe(1);
  });
});
