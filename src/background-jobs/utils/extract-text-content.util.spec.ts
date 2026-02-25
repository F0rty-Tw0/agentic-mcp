import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';

import { extractTextContent } from './extract-text-content.util';

describe('extractTextContent', () => {
  it('GIVEN response with text content WHEN called THEN returns the text', () => {
    const response: CallToolResult = {
      content: [{ type: 'text', text: 'hello world' }],
    };

    expect(extractTextContent(response)).toBe('hello world');
  });

  it('GIVEN response with empty text WHEN called THEN returns empty string', () => {
    const response: CallToolResult = {
      content: [{ type: 'text', text: '' }],
    };

    expect(extractTextContent(response)).toBe('');
  });

  it('GIVEN response with image content WHEN called THEN returns empty string', () => {
    const response: CallToolResult = {
      content: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }],
    };

    expect(extractTextContent(response)).toBe('');
  });

  it('GIVEN response with empty content array WHEN called THEN returns empty string', () => {
    const response: CallToolResult = {
      content: [],
    };

    expect(extractTextContent(response)).toBe('');
  });

  it('GIVEN response with multiple content items WHEN called THEN returns text from first item only', () => {
    const response: CallToolResult = {
      content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ],
    };

    expect(extractTextContent(response)).toBe('first');
  });

  it('GIVEN response with non-text first item and text second WHEN called THEN returns empty string', () => {
    const response: CallToolResult = {
      content: [
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
        { type: 'text', text: 'second' },
      ],
    };

    expect(extractTextContent(response)).toBe('');
  });
});
