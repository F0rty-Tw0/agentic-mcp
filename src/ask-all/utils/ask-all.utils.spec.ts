import type { CallToolResult } from '@modelcontextprotocol/sdk/spec.types.js';
import type { ContentBlock, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';

import { extractResponseText } from './ask-all.utils';

describe('extractResponseText', () => {
  it('GIVEN response with text content WHEN called THEN returns the text', () => {
    const content: TextContent[] = [{ type: 'text', text: 'hello world' }];
    const result: CallToolResult = {
      content,
    };

    expect(extractResponseText(result)).toBe('hello world');
  });

  it('GIVEN response with empty text WHEN called THEN returns empty string', () => {
    const content: TextContent[] = [{ type: 'text', text: '' }];
    const result: CallToolResult = {
      content,
    };

    expect(extractResponseText(result)).toBe('');
  });

  it('GIVEN response with image content WHEN called THEN returns empty string', () => {
    const content: ContentBlock[] = [{ type: 'image', data: 'base64data', mimeType: 'image/png' }];
    const result: CallToolResult = {
      content,
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
    const content: TextContent[] = [
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ];
    const result: CallToolResult = {
      content,
    };

    expect(extractResponseText(result)).toBe('first');
  });

  it('GIVEN response with non-text first item and text second WHEN called THEN returns empty string', () => {
    const content: ContentBlock[] = [
      { type: 'image', data: 'base64data', mimeType: 'image/png' },
      { type: 'text', text: 'second' },
    ];
    const result: CallToolResult = {
      content,
    };

    expect(extractResponseText(result)).toBe('');
  });
});
