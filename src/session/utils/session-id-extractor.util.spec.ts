import { describe, expect, it } from 'vitest';

import { extractNativeSessionId } from './session-id-extractor.util';

describe('extractNativeSessionId', () => {
  it('GIVEN JSON output WHEN extracting THEN returns session_id', () => {
    const sessionId = extractNativeSessionId('claude', JSON.stringify({ session_id: 'abc-123' }), 'json');

    expect(sessionId).toBe('abc-123');
  });

  it('GIVEN JSON output with nested session id WHEN extracting THEN returns nested id', () => {
    const session = { id: 'nested-1' };
    const sessionId = extractNativeSessionId('claude', JSON.stringify({ session }), 'json');

    expect(sessionId).toBe('nested-1');
  });

  it('GIVEN JSON output with non-string nested session id WHEN extracting THEN returns undefined', () => {
    const session = { id: 123 };
    const sessionId = extractNativeSessionId('claude', JSON.stringify({ session }), 'json');

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
    const outputLines = ['{"type":"progress"}', '{"conversation_id":"codex-1"}'];
    const output = outputLines.join('\n');
    const sessionId = extractNativeSessionId('codex', output, 'stream-json');

    expect(sessionId).toBe('codex-1');
  });

  it('GIVEN stream output with only whitespace WHEN extracting THEN returns undefined', () => {
    const sessionId = extractNativeSessionId('codex', ' \n\n ', 'stream-json');

    expect(sessionId).toBeUndefined();
  });

  it('GIVEN stream output with invalid last line WHEN extracting THEN returns undefined', () => {
    const outputLines = ['{"type":"progress"}', 'not-json'];
    const output = outputLines.join('\n');
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
    const outputLines = ['{"type":"progress"}', '{"conversation_id":"codex-fallback-1"}'];
    const output = outputLines.join('\n');
    const sessionId = extractNativeSessionId('codex', output, 'json');

    expect(sessionId).toBe('codex-fallback-1');
  });

  it('GIVEN non-codex provider with ndjson in json mode WHEN extracting THEN falls back to ndjson parser', () => {
    const outputLines = ['{"type":"progress"}', '{"conversation_id":"non-codex-1"}'];
    const output = outputLines.join('\n');
    const sessionId = extractNativeSessionId('claude', output, 'json');

    expect(sessionId).toBe('non-codex-1');
  });

  it('GIVEN codex exec events with thread_id on the first line WHEN extracting THEN returns the thread id', () => {
    const outputLines = [
      '{"type":"thread.started","thread_id":"0199a213-81c0-7800-8aa1-bbab2a035a53"}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"hi"}}',
      '{"type":"turn.completed","usage":{"input_tokens":1}}',
    ];
    const output = outputLines.join('\n');
    const sessionId = extractNativeSessionId('codex', output, 'json');

    expect(sessionId).toBe('0199a213-81c0-7800-8aa1-bbab2a035a53');
  });

  it('GIVEN opencode events with camelCase sessionID WHEN extracting THEN returns the session id', () => {
    const outputLines = [
      '{"type":"step_start","timestamp":1,"sessionID":"ses_abc123"}',
      '{"type":"text","timestamp":2,"sessionID":"ses_abc123","part":{"text":"hi"}}',
    ];
    const output = outputLines.join('\n');
    const sessionId = extractNativeSessionId('opencode', output, 'json');

    expect(sessionId).toBe('ses_abc123');
  });

  it('GIVEN stream-json with a stray non-JSON last line WHEN extracting THEN returns the id from an earlier line', () => {
    const outputLines = ['{"type":"system","session_id":"claude-7"}', 'Warning: truncated'];
    const output = outputLines.join('\n');
    const sessionId = extractNativeSessionId('claude', output, 'stream-json');

    expect(sessionId).toBe('claude-7');
  });
});
