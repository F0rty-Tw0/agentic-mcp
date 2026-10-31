import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';

import type { SessionMode } from '../common';
import { appendSessionMetadata } from './session-metadata.util';

const createCallToolResult = (overrides: Partial<CallToolResult> = {}): CallToolResult => {
  const content: TextContent[] = [{ type: 'text', text: 'response text' }];
  const result: CallToolResult = {
    content,
    isError: false,
    ...overrides,
  };

  return result;
};

describe('appendSessionMetadata', () => {
  it('GIVEN sessionMode "none" WHEN appendSessionMetadata called THEN returns response unchanged', () => {
    const content: TextContent[] = [{ type: 'text', text: 'hello' }];
    const response = createCallToolResult({ content });

    const result = appendSessionMetadata(response, 'none');

    expect(result).toBe(response);
  });

  it('GIVEN structuredContent exists WHEN appendSessionMetadata called THEN merges sessionMode into structuredContent', () => {
    const attribution = { provider: 'test' };
    const structuredContent = { response: 'hello', attribution };
    const content: TextContent[] = [{ type: 'text', text: 'hello' }];
    const response = createCallToolResult({
      content,
      structuredContent,
    });
    const mode: SessionMode = 'tier1-prepend';

    const result = appendSessionMetadata(response, mode);

    const expectedAttribution = { provider: 'test', sessionMode: 'tier1-prepend' };

    expect(result.content).toHaveLength(1);
    expect(result.structuredContent).toStrictEqual({
      response: 'hello',
      attribution: expectedAttribution,
      sessionMode: 'tier1-prepend',
    });
  });

  it('GIVEN structuredContent is absent WHEN appendSessionMetadata called THEN returns response unchanged', () => {
    const content: TextContent[] = [{ type: 'text', text: 'hello' }];
    const response = createCallToolResult({ content });
    const mode: SessionMode = 'tier2-native';

    const result = appendSessionMetadata(response, mode);

    expect(result).toBe(response);
    expect(result.structuredContent).toBeUndefined();
  });
});
