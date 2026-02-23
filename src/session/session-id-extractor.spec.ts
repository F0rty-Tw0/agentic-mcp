import { describe, expect, it } from 'vitest';

import { extractNativeSessionId } from './session-id-extractor.ts';

describe('extractNativeSessionId', () => {
  it('GIVEN JSON output WHEN extracting THEN returns session_id', () => {
    const sessionId = extractNativeSessionId('claude', JSON.stringify({ session_id: 'abc-123' }), 'json');

    expect(sessionId).toBe('abc-123');
  });

  it('GIVEN NDJSON output WHEN extracting THEN returns conversation_id from last line', () => {
    const output = ['{"type":"progress"}', '{"conversation_id":"codex-1"}'].join('\n');
    const sessionId = extractNativeSessionId('codex', output, 'stream-json');

    expect(sessionId).toBe('codex-1');
  });

  it('GIVEN text output WHEN extracting THEN returns regex session id', () => {
    const sessionId = extractNativeSessionId('copilot', 'Session: cp-1', 'text');

    expect(sessionId).toBe('cp-1');
  });
});
