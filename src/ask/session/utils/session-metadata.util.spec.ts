import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';

import { appendSessionMetadata } from './session-metadata.util';
import type { SessionMode } from '../../common';

const createCallToolResult = (overrides: Partial<CallToolResult> = {}): CallToolResult => ({
  content: [{ type: 'text', text: 'response text' }],
  isError: false,
  ...overrides,
});

describe('appendSessionMetadata', () => {
  it('GIVEN sessionMode "none" WHEN appendSessionMetadata called THEN returns response unchanged', () => {
    const response = createCallToolResult({ content: [{ type: 'text', text: 'hello' }] });

    const result = appendSessionMetadata(response, 'none');

    expect(result).toBe(response);
  });

  it('GIVEN structuredContent exists WHEN appendSessionMetadata called THEN merges sessionMode into structuredContent', () => {
    const response = createCallToolResult({
      content: [{ type: 'text', text: 'hello' }],
      structuredContent: { response: 'hello', attribution: { provider: 'test' } },
    });
    const mode: SessionMode = 'tier1-prepend';

    const result = appendSessionMetadata(response, mode);

    expect(result.content).toHaveLength(1);
    expect(result.structuredContent).toStrictEqual({
      response: 'hello',
      attribution: { provider: 'test', sessionMode: 'tier1-prepend' },
      sessionMode: 'tier1-prepend',
    });
  });

  it('GIVEN structuredContent is absent WHEN appendSessionMetadata called THEN returns response unchanged', () => {
    const response = createCallToolResult({ content: [{ type: 'text', text: 'hello' }] });
    const mode: SessionMode = 'tier2-native';

    const result = appendSessionMetadata(response, mode);

    expect(result).toBe(response);
    expect(result.structuredContent).toBeUndefined();
  });
});
