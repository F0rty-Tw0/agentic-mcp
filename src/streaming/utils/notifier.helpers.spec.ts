/* eslint-disable @typescript-eslint/naming-convention */
import { describe, expect, it } from 'vitest';

import {
  buildExecutionSummary,
  buildStreamDiagnostics,
  createNoopStreamNotifier,
  isStreamEnabled,
  resolveProgressToken,
  splitChunkByBytes,
  withEventEnvelope,
} from './notifier.helpers';
import type { ProgressContext } from '../../shared';
import { ASK_STREAM_EVENT_SCHEMA, MAX_STREAM_CHUNK_BYTES, TERMINAL_EVENT_GRACE_TIMEOUT_MS } from '../common';

describe('resolveProgressToken', () => {
  it('GIVEN no extra WHEN called THEN returns undefined', () => {
    const result = resolveProgressToken(undefined);

    expect(result).toBeUndefined();
  });

  it('GIVEN extra without sendNotification WHEN called THEN returns undefined', () => {
    const extra = { _meta: { progressToken: 42 } } as ProgressContext;

    const result = resolveProgressToken(extra);

    expect(result).toBeUndefined();
  });

  it('GIVEN extra with sendNotification but no _meta WHEN called THEN returns undefined', () => {
    const extra = { sendNotification: async () => {}, _meta: undefined } as ProgressContext;

    const result = resolveProgressToken(extra);

    expect(result).toBeUndefined();
  });

  it('GIVEN extra with sendNotification and numeric progressToken WHEN called THEN returns the token', () => {
    const extra = {
      sendNotification: async () => {},
      _meta: { progressToken: 7 },
    } as ProgressContext;

    const result = resolveProgressToken(extra);

    expect(result).toBe(7);
  });

  it('GIVEN extra with sendNotification and string progressToken WHEN called THEN returns the token', () => {
    const extra = {
      sendNotification: async () => {},
      _meta: { progressToken: 'tok-abc' },
    } as ProgressContext;

    const result = resolveProgressToken(extra);

    expect(result).toBe('tok-abc');
  });
});

describe('isStreamEnabled', () => {
  it('GIVEN stream_live=true and valid progressToken and sendNotification WHEN called THEN returns true', () => {
    const extra = { sendNotification: async () => {}, _meta: {} } as ProgressContext;

    const result = isStreamEnabled({ args: { stream_live: true }, progressToken: 1, extra });

    expect(result).toBe(true);
  });

  it('GIVEN stream_live=false WHEN called THEN returns false', () => {
    const extra = { sendNotification: async () => {}, _meta: {} } as ProgressContext;

    const result = isStreamEnabled({ args: { stream_live: false }, progressToken: 1, extra });

    expect(result).toBe(false);
  });

  it('GIVEN stream_live=true but undefined progressToken WHEN called THEN returns false', () => {
    const extra = { sendNotification: async () => {}, _meta: {} } as ProgressContext;

    const result = isStreamEnabled({ args: { stream_live: true }, progressToken: undefined, extra });

    expect(result).toBe(false);
  });

  it('GIVEN stream_live=true but no sendNotification WHEN called THEN returns false', () => {
    const extra = { _meta: {} } as ProgressContext;

    const result = isStreamEnabled({ args: { stream_live: true }, progressToken: 1, extra });

    expect(result).toBe(false);
  });
});

describe('splitChunkByBytes', () => {
  it('GIVEN small chunk within limit WHEN called THEN returns single-element array', () => {
    const chunk = 'hello';

    const result = splitChunkByBytes(chunk);

    expect(result).toStrictEqual(['hello']);
  });

  it('GIVEN chunk exceeding limit WHEN called THEN returns multiple chunks', () => {
    const chunk = 'a'.repeat(MAX_STREAM_CHUNK_BYTES + 10);

    const result = splitChunkByBytes(chunk);

    expect(result.length).toBeGreaterThan(1);

    const rejoined = result.join('');

    expect(rejoined).toBe(chunk);

    for (const part of result) {
      expect(Buffer.byteLength(part, 'utf-8')).toBeLessThanOrEqual(MAX_STREAM_CHUNK_BYTES);
    }
  });

  it('GIVEN empty string WHEN called THEN returns single-element array with empty string', () => {
    const result = splitChunkByBytes('');

    expect(result).toStrictEqual(['']);
  });

  it('GIVEN multi-byte characters exceeding limit WHEN splitChunkByBytes called THEN splits correctly respecting character boundaries', () => {
    const multiByteChar = '\u00e9';
    const charBytes = Buffer.byteLength(multiByteChar, 'utf-8');
    const repeatCount = Math.floor(MAX_STREAM_CHUNK_BYTES / charBytes) + 5;
    const chunk = multiByteChar.repeat(repeatCount);

    const result = splitChunkByBytes(chunk);

    expect(result.length).toBeGreaterThan(1);
    expect(result.join('')).toBe(chunk);

    for (const part of result) {
      expect(Buffer.byteLength(part, 'utf-8')).toBeLessThanOrEqual(MAX_STREAM_CHUNK_BYTES);
    }

    for (const part of result) {
      expect(part).not.toContain('\uFFFD');
    }
  });
});

describe('buildStreamDiagnostics', () => {
  it('GIVEN sequence 5 WHEN called THEN lastSequence is 4', () => {
    const result = buildStreamDiagnostics({
      streamId: 'sid-1',
      sequence: 5,
      emittedChunks: 0,
      droppedChunks: 0,
      coalescedChunks: 0,
    });

    expect(result.lastSequence).toBe(4);
  });

  it('GIVEN all fields WHEN called THEN returns complete diagnostics object', () => {
    const result = buildStreamDiagnostics({
      streamId: 'sid-2',
      sequence: 10,
      emittedChunks: 3,
      droppedChunks: 1,
      coalescedChunks: 2,
    });

    expect(result).toStrictEqual({
      streamId: 'sid-2',
      lastSequence: 9,
      emittedChunks: 3,
      droppedChunks: 1,
      coalescedChunks: 2,
      terminalEventGraceTimeoutMs: TERMINAL_EVENT_GRACE_TIMEOUT_MS,
    });
  });
});

describe('withEventEnvelope', () => {
  it('GIVEN event payload WHEN called THEN wraps with schema, sequence, streamId, timestamp', () => {
    const before = Date.now();
    const event = { type: 'start' as const, channel: 'system' as const };

    const result = withEventEnvelope(event, 'stream-xyz', 3);

    const after = Date.now();
    const resultTimestamp = new Date(result.timestamp).getTime();

    expect(result.schema).toBe(ASK_STREAM_EVENT_SCHEMA);
    expect(result.sequence).toBe(3);
    expect(result.streamId).toBe('stream-xyz');
    expect(result.type).toBe('start');
    expect(result.channel).toBe('system');
    expect(resultTimestamp).toBeGreaterThanOrEqual(before);
    expect(resultTimestamp).toBeLessThanOrEqual(after);
  });
});

describe('createNoopStreamNotifier', () => {
  it('GIVEN called WHEN inspecting result THEN enabled is false', () => {
    const notifier = createNoopStreamNotifier();

    expect(notifier.enabled).toBe(false);
  });

  it('GIVEN called WHEN calling onStdoutChunk THEN does not throw', () => {
    const notifier = createNoopStreamNotifier();

    expect(() => notifier.onStdoutChunk('some output')).not.toThrow();
  });

  it('GIVEN called WHEN calling onStderrChunk THEN does not throw', () => {
    const notifier = createNoopStreamNotifier();

    expect(() => notifier.onStderrChunk('error output')).not.toThrow();
  });

  it('GIVEN called WHEN calling emitStart THEN does not throw', () => {
    const notifier = createNoopStreamNotifier();

    expect(() => notifier.emitStart()).not.toThrow();
  });

  it('GIVEN called WHEN calling emitDone THEN does not throw', () => {
    const notifier = createNoopStreamNotifier();
    const summary = {
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 0,
      stderrBytes: 0,
      executionTimeMs: 0,
    };

    expect(() => notifier.emitDone(summary)).not.toThrow();
  });

  it('GIVEN called WHEN calling emitError THEN does not throw', () => {
    const notifier = createNoopStreamNotifier();

    expect(() => notifier.emitError('something went wrong')).not.toThrow();
  });

  it('GIVEN called WHEN calling stop THEN does not throw', () => {
    const notifier = createNoopStreamNotifier();

    expect(() => notifier.stop()).not.toThrow();
  });
});

describe('buildExecutionSummary', () => {
  it('GIVEN result object WHEN called THEN maps all fields correctly', () => {
    const input = {
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: true,
      stdoutBytes: 1024,
      stderrBytes: 256,
      executionTimeMs: 3500,
    };

    const result = buildExecutionSummary(input);

    expect(result).toStrictEqual({
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: true,
      stdoutBytes: 1024,
      stderrBytes: 256,
      executionTimeMs: 3500,
    });
  });
});
