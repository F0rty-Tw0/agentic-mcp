import type { CallToolResult, ContentBlock, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';

import { extractTextContent } from './extract-text-content.util';

describe('extractTextContent', () => {
  it('GIVEN response with text content WHEN called THEN returns the text', () => {
    const content: TextContent[] = [{ type: 'text', text: 'hello world' }];
    const response: CallToolResult = {
      content,
    };

    expect(extractTextContent(response)).toBe('hello world');
  });

  it('GIVEN response with empty text WHEN called THEN returns empty string', () => {
    const content: TextContent[] = [{ type: 'text', text: '' }];
    const response: CallToolResult = {
      content,
    };

    expect(extractTextContent(response)).toBe('');
  });

  it('GIVEN response with image content WHEN called THEN returns empty string', () => {
    const content: ContentBlock[] = [{ type: 'image', data: 'base64data', mimeType: 'image/png' }];
    const response: CallToolResult = {
      content,
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
    const content: TextContent[] = [
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ];
    const response: CallToolResult = {
      content,
    };

    expect(extractTextContent(response)).toBe('first');
  });

  it('GIVEN response with non-text first item and text second WHEN called THEN returns empty string', () => {
    const content: ContentBlock[] = [
      { type: 'image', data: 'base64data', mimeType: 'image/png' },
      { type: 'text', text: 'second' },
    ];
    const response: CallToolResult = {
      content,
    };

    expect(extractTextContent(response)).toBe('');
  });
});
