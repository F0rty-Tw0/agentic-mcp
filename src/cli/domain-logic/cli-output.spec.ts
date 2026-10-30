import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { extractResultText, printResult } from './cli-output';

type ContentPart = CallToolResult['content'][number];

const IMAGE_PART: ContentPart = { type: 'image', data: '...', mimeType: 'image/png' };

const buildTextPart = (text: string): ContentPart => {
  const part: ContentPart = { type: 'text', text };

  return part;
};

const buildAttributedStructuredContent = (): Record<string, unknown> => {
  const attribution = { provider: 'test' };
  const structuredContent = { response: 'hello', attribution };

  return structuredContent;
};

describe('extractResultText', () => {
  it('GIVEN single text content WHEN extracted THEN returns text string', () => {
    const content = [buildTextPart('hello')];
    const result = extractResultText({ content });

    expect(result).toBe('hello');
  });

  it('GIVEN multiple text contents WHEN extracted THEN joins with newline', () => {
    const content = [buildTextPart('first'), buildTextPart('second')];
    const result = extractResultText({ content });

    expect(result).toBe('first\nsecond');
  });

  it('GIVEN non-text content only WHEN extracted THEN returns empty string', () => {
    const content = [IMAGE_PART];
    const result = extractResultText({ content });

    expect(result).toBe('');
  });

  it('GIVEN mixed text and non-text content WHEN extracted THEN returns only text parts', () => {
    const content = [buildTextPart('hello'), IMAGE_PART, buildTextPart('world')];
    const result = extractResultText({ content });

    expect(result).toBe('hello\nworld');
  });
  it('GIVEN structuredContent WHEN extracted THEN appends formatted JSON after text content', () => {
    const content = [buildTextPart('hello')];
    const structuredContent = buildAttributedStructuredContent();
    const result = extractResultText({ content, structuredContent });

    expect(result).toBe('hello\n{\n  "response": "hello",\n  "attribution": {\n    "provider": "test"\n  }\n}');
  });

  it('GIVEN no text content and structuredContent WHEN extracted THEN returns formatted JSON', () => {
    const content = [IMAGE_PART];
    const structuredContent = { response: 'hello' };
    const result = extractResultText({ content, structuredContent });

    expect(result).toBe('{\n  "response": "hello"\n}');
  });

  it('GIVEN structuredContent and includeStructuredContent false WHEN extracted THEN it returns text only', () => {
    const content = [buildTextPart('hello')];
    const structuredContent = { response: 'hello' };
    const result = extractResultText({ content, structuredContent }, { includeStructuredContent: false });

    expect(result).toBe('hello');
  });
});

describe('printResult', () => {
  let stdoutSpy: MockInstance;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('GIVEN successful result WHEN printed THEN writes to stdout', () => {
    const content = [buildTextPart('hello')];

    printResult({ content });

    expect(stdoutSpy).toHaveBeenCalledWith('hello\n');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('GIVEN successful result WHEN printed THEN does not set exitCode', () => {
    const content = [buildTextPart('hello')];

    printResult({ content });

    expect(process.exitCode).toBeUndefined();
  });

  it('GIVEN error result WHEN printed THEN writes to stderr', () => {
    const content = [buildTextPart('oops')];

    printResult({ content, isError: true });

    expect(stderrSpy).toHaveBeenCalledWith('oops\n');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('GIVEN successful result with structuredContent WHEN printed THEN writes text and formatted JSON to stdout', () => {
    const content = [buildTextPart('hello')];
    const structuredContent = buildAttributedStructuredContent();

    printResult({ content, structuredContent });

    expect(stdoutSpy).toHaveBeenCalledWith(
      'hello\n{\n  "response": "hello",\n  "attribution": {\n    "provider": "test"\n  }\n}\n'
    );
  });

  it('GIVEN successful result with structuredContent and includeStructuredContent false WHEN printed THEN it writes text without JSON', () => {
    const content = [buildTextPart('hello')];
    const structuredContent = buildAttributedStructuredContent();

    printResult({ content, structuredContent }, { includeStructuredContent: false });

    expect(stdoutSpy).toHaveBeenCalledWith('hello\n');
  });
  it('GIVEN error result WHEN printed THEN sets exitCode to 1', () => {
    const content = [buildTextPart('oops')];

    printResult({ content, isError: true });

    expect(process.exitCode).toBe(1);
  });
});
