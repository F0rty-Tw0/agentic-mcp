import { describe, expect, it } from 'vitest';

import { extractNativeSessionId } from './session-id-extractor.util';

describe('extractNativeSessionId', () => {
  it('GIVEN JSON output WHEN extracting THEN returns session_id', () => {
    const sessionId = extractNativeSessionId('claude', JSON.stringify({ session_id: 'abc-123' }), 'json');

    expect(sessionId).toBe('abc-123');
  });

  it('GIVEN JSON output with nested session id WHEN extracting THEN returns nested id', () => {
    const sessionId = extractNativeSessionId('claude', JSON.stringify({ session: { id: 'nested-1' } }), 'json');

    expect(sessionId).toBe('nested-1');
  });

  it('GIVEN JSON output with non-string nested session id WHEN extracting THEN returns undefined', () => {
    const sessionId = extractNativeSessionId('claude', JSON.stringify({ session: { id: 123 } }), 'json');

    expect(sessionId).toBeUndefined();
  });

  it('GIVEN invalid JSON output WHEN extracting in json mode THEN returns undefined', () => {
    const sessionId = extractNativeSessionId('claude', '{not-json}', 'json');

    expect(sessionId).toBeUndefined();
  });

  it('GIVEN invalid session_id value WHEN extracting in json mode THEN returns undefined', () => {
    const sessionId = extractNativeSessionId('claude', JSON.stringify({ session_id: 'bad id with spaces' }), 'json');

    expect(sessionId).toBeUndefined();
  });

  it('GIVEN NDJSON output WHEN extracting THEN returns conversation_id from last line', () => {
    const output = ['{"type":"progress"}', '{"conversation_id":"codex-1"}'].join('\n');
    const sessionId = extractNativeSessionId('codex', output, 'stream-json');

    expect(sessionId).toBe('codex-1');
  });

  it('GIVEN stream output with only whitespace WHEN extracting THEN returns undefined', () => {
    const sessionId = extractNativeSessionId('codex', ' \n\n ', 'stream-json');

    expect(sessionId).toBeUndefined();
  });

  it('GIVEN stream output with invalid last line WHEN extracting THEN returns undefined', () => {
    const output = ['{"type":"progress"}', 'not-json'].join('\n');
    const sessionId = extractNativeSessionId('codex', output, 'stream-json');

    expect(sessionId).toBeUndefined();
  });

  it('GIVEN text output WHEN extracting THEN returns regex session id', () => {
    const sessionId = extractNativeSessionId('copilot', 'Session: cp-1', 'text');

    expect(sessionId).toBe('cp-1');
  });

  it('GIVEN text output without session label WHEN extracting THEN returns undefined', () => {
    const sessionId = extractNativeSessionId('copilot', 'No session present', 'text');

    expect(sessionId).toBeUndefined();
  });

  it('GIVEN text output with invalid session id WHEN extracting THEN returns undefined', () => {
    const sessionId = extractNativeSessionId('copilot', 'Session: -bad', 'text');

    expect(sessionId).toBeUndefined();
  });

  it('GIVEN codex provider with ndjson in json mode WHEN extracting THEN falls back to ndjson parser', () => {
    const output = ['{"type":"progress"}', '{"conversation_id":"codex-fallback-1"}'].join('\n');
    const sessionId = extractNativeSessionId('codex', output, 'json');

    expect(sessionId).toBe('codex-fallback-1');
  });

  it('GIVEN non-codex provider with ndjson in json mode WHEN extracting THEN returns undefined', () => {
    const output = ['{"type":"progress"}', '{"conversation_id":"non-codex-1"}'].join('\n');
    const sessionId = extractNativeSessionId('claude', output, 'json');

    expect(sessionId).toBeUndefined();
  });
});
