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

  it('GIVEN sessionMode "tier1-prepend" WHEN appendSessionMetadata called THEN appends metadata content', () => {
    const response = createCallToolResult({ content: [{ type: 'text', text: 'hello' }] });
    const mode: SessionMode = 'tier1-prepend';

    const result = appendSessionMetadata(response, mode);

    expect(result.content).toHaveLength(2);
    const last = result.content.at(-1);

    expect(last).toStrictEqual({
      type: 'text',
      text: JSON.stringify({ sessionMode: 'tier1-prepend' }, null, 2),
    });
  });

  it('GIVEN sessionMode "tier2-native" WHEN appendSessionMetadata called THEN appends metadata content', () => {
    const response = createCallToolResult({ content: [{ type: 'text', text: 'hello' }] });
    const mode: SessionMode = 'tier2-native';

    const result = appendSessionMetadata(response, mode);

    expect(result.content).toHaveLength(2);
    const last = result.content.at(-1);

    expect(last).toStrictEqual({
      type: 'text',
      text: JSON.stringify({ sessionMode: 'tier2-native' }, null, 2),
    });
  });
});
