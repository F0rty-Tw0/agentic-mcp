import type { CallToolResult } from '@modelcontextprotocol/sdk/spec.types.js';
import { describe, expect, it } from 'vitest';

import { extractResponseText } from './ask-all.utils';

describe('extractResponseText', () => {
  it('GIVEN response with text content WHEN called THEN returns the text', () => {
    const result: CallToolResult = {
      content: [{ type: 'text', text: 'hello world' }],
    };

    expect(extractResponseText(result)).toBe('hello world');
  });

  it('GIVEN response with empty text WHEN called THEN returns empty string', () => {
    const result: CallToolResult = {
      content: [{ type: 'text', text: '' }],
    };

    expect(extractResponseText(result)).toBe('');
  });

  it('GIVEN response with image content WHEN called THEN returns empty string', () => {
    const result: CallToolResult = {
      content: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }],
    };

    expect(extractResponseText(result)).toBe('');
  });

  it('GIVEN response with empty content array WHEN called THEN returns empty string', () => {
    const result: CallToolResult = {
      content: [],
    };

    expect(extractResponseText(result)).toBe('');
  });

  it('GIVEN response with multiple content items WHEN called THEN returns text from first item only', () => {
    const result: CallToolResult = {
      content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ],
    };

    expect(extractResponseText(result)).toBe('first');
  });

  it('GIVEN response with non-text first item and text second WHEN called THEN returns empty string', () => {
    const result: CallToolResult = {
      content: [
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
        { type: 'text', text: 'second' },
      ],
    };

    expect(extractResponseText(result)).toBe('');
  });
});
