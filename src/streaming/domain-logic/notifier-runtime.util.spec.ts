import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitDone, emitError, emitSystemEvent, queueChunk } from './notifier-runtime.util';
import type { NotifierState } from './notifier-runtime.util';
import { buildStreamDiagnostics, splitChunkByBytes, withEventEnvelope } from './notifier.helpers';
import type { ProgressContext, ProgressToken } from '../../shared';
import { STREAM_COALESCE_WINDOW_MS } from '../common';
import type { AskStreamDiagnostics } from '../common';

vi.mock('./notifier.helpers');

const makeDiagnostics = (): AskStreamDiagnostics => ({
  streamId: 'stream-test',
  lastSequence: 0,
  emittedChunks: 0,
  droppedChunks: 0,
  coalescedChunks: 0,
  terminalEventGraceTimeoutMs: 5_000,
});

const makeState = (overrides?: Partial<NotifierState>): NotifierState => ({
  streamId: 'stream-test',
  sequence: 1,
  emittedChunks: 0,
  droppedChunks: 0,
  coalescedChunks: 0,
  queuedStdout: '',
  queuedStderr: '',
  lastChunkAtMs: 0,
  stopped: false,
  flushTimer: undefined,
  ...overrides,
});

const makeContext = (): { extra: ProgressContext; progressToken: ProgressToken } => ({
  extra: {
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
  progressToken: 42,
});

beforeEach(() => {
  vi.useFakeTimers();

  vi.mocked(splitChunkByBytes).mockImplementation((chunk: string) => (chunk.length === 0 ? [] : [chunk]));

  vi.mocked(withEventEnvelope).mockImplementation(
    (event, streamId, sequence) =>
      ({ schema: 'ask-stream-v1', sequence, streamId, timestamp: '2026-01-01T00:00:00.000Z', ...event }) as never
  );

  vi.mocked(buildStreamDiagnostics).mockReturnValue(makeDiagnostics());
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('queueChunk', () => {
  it('GIVEN empty chunk WHEN called THEN does not modify state or set timer', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stdout', '', context);

    expect(state.queuedStdout).toBe('');
    expect(state.flushTimer).toBeUndefined();
    expect(state.lastChunkAtMs).toBe(0);
  });

  it('GIVEN stdout chunk WHEN called THEN appends to queuedStdout and updates lastChunkAtMs', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stdout', 'hello', context);

    expect(state.queuedStdout).toBe('hello');
    expect(state.lastChunkAtMs).toBeGreaterThan(0);
    expect(state.flushTimer).toBeDefined();
  });

  it('GIVEN stderr chunk WHEN called THEN appends to queuedStderr', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stderr', 'error', context);

    expect(state.queuedStderr).toBe('error');
  });

  it('GIVEN existing stdout queue WHEN second chunk arrives THEN coalesces and increments counter', () => {
    const state = makeState({ queuedStdout: 'first' });
    const context = makeContext();

    queueChunk(state, 'stdout', 'second', context);

    expect(state.coalescedChunks).toBe(1);
    expect(state.queuedStdout).toBe('firstsecond');
  });

  it('GIVEN existing stderr queue WHEN second chunk arrives THEN coalesces and increments counter', () => {
    const state = makeState({ queuedStderr: 'first' });
    const context = makeContext();

    queueChunk(state, 'stderr', 'second', context);

    expect(state.coalescedChunks).toBe(1);
    expect(state.queuedStderr).toBe('firstsecond');
  });

  it('GIVEN flush timer already set WHEN another chunk queued THEN does not create new timer', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stdout', 'first', context);
    const firstTimer = state.flushTimer;

    queueChunk(state, 'stdout', 'second', context);

    expect(state.flushTimer).toBe(firstTimer);
  });

  it('GIVEN queued stdout WHEN flush timer fires THEN emits chunk and resets queue', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stdout', 'hello', context);
    vi.advanceTimersByTime(STREAM_COALESCE_WINDOW_MS);

    expect(splitChunkByBytes).toHaveBeenCalledWith('hello');
    expect(state.emittedChunks).toBe(1);
    expect(state.queuedStdout).toBe('');
    expect(state.flushTimer).toBeUndefined();
    expect(context.extra.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('GIVEN both channels queued WHEN flush fires THEN emits both and resets both queues', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stdout', 'out', context);
    queueChunk(state, 'stderr', 'err', context);
    vi.advanceTimersByTime(STREAM_COALESCE_WINDOW_MS);

    expect(state.emittedChunks).toBe(2);
    expect(state.queuedStdout).toBe('');
    expect(state.queuedStderr).toBe('');
    expect(context.extra.sendNotification).toHaveBeenCalledTimes(2);
  });

  it('GIVEN sendNotification rejects for chunk WHEN flush fires THEN increments droppedChunks', async () => {
    const state = makeState();
    const context = makeContext();

    vi.mocked(context.extra.sendNotification).mockRejectedValue(new Error('network'));

    queueChunk(state, 'stdout', 'hello', context);
    vi.advanceTimersByTime(STREAM_COALESCE_WINDOW_MS);

    await Promise.resolve();

    expect(state.droppedChunks).toBe(1);
  });
});

describe('emitSystemEvent', () => {
  it('GIVEN active state WHEN called with start THEN emits start event and increments sequence', () => {
    const state = makeState();
    const context = makeContext();

    emitSystemEvent(state, context, 'start');

    expect(withEventEnvelope).toHaveBeenCalledWith({ type: 'start', channel: 'system' }, 'stream-test', 1);
    expect(state.sequence).toBe(2);
    expect(context.extra.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('GIVEN active state WHEN called with heartbeat THEN emits heartbeat event', () => {
    const state = makeState();
    const context = makeContext();

    emitSystemEvent(state, context, 'heartbeat');

    expect(withEventEnvelope).toHaveBeenCalledWith({ type: 'heartbeat', channel: 'system' }, 'stream-test', 1);
  });

  it('GIVEN stopped state WHEN called THEN does not emit', () => {
    const state = makeState({ stopped: true });
    const context = makeContext();

    emitSystemEvent(state, context, 'start');

    expect(context.extra.sendNotification).not.toHaveBeenCalled();
    expect(state.sequence).toBe(1);
  });

  it('GIVEN sendNotification rejects for system event WHEN called THEN does NOT increment droppedChunks', async () => {
    const state = makeState();
    const context = makeContext();

    vi.mocked(context.extra.sendNotification).mockRejectedValue(new Error('fail'));

    emitSystemEvent(state, context, 'start');

    await Promise.resolve();

    expect(state.droppedChunks).toBe(0);
  });
});

describe('emitDone', () => {
  it('GIVEN no pending flush WHEN called THEN emits done event with summary and diagnostics', () => {
    const state = makeState();
    const context = makeContext();
    const summary = {
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 100,
      stderrBytes: 0,
      executionTimeMs: 500,
    };

    emitDone(state, context, summary);

    expect(buildStreamDiagnostics).toHaveBeenCalledWith(state);
    expect(withEventEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', channel: 'system', summary }),
      'stream-test',
      1
    );
    expect(context.extra.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('GIVEN pending flush with queued stdout WHEN called THEN flushes chunks before emitting done', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stdout', 'buffered', context);

    expect(context.extra.sendNotification).not.toHaveBeenCalled();

    const summary = {
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 100,
      stderrBytes: 0,
      executionTimeMs: 500,
    };

    emitDone(state, context, summary);

    expect(state.queuedStdout).toBe('');
    expect(state.emittedChunks).toBe(1);
    expect(context.extra.sendNotification).toHaveBeenCalledTimes(2);
  });

  it('GIVEN pending flush WHEN called THEN clears flush timer', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stdout', 'data', context);

    expect(state.flushTimer).toBeDefined();

    const summary = {
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 0,
      stderrBytes: 0,
      executionTimeMs: 0,
    };

    emitDone(state, context, summary);

    expect(state.flushTimer).toBeUndefined();
  });
});

describe('emitError', () => {
  it('GIVEN no pending flush WHEN called THEN emits error event with error string and diagnostics', () => {
    const state = makeState();
    const context = makeContext();

    emitError(state, context, 'something failed');

    expect(buildStreamDiagnostics).toHaveBeenCalledWith(state);
    expect(withEventEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', channel: 'system', error: 'something failed' }),
      'stream-test',
      1
    );
    expect(context.extra.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('GIVEN summary provided WHEN called THEN includes summary in error event', () => {
    const state = makeState();
    const context = makeContext();
    const summary = {
      exitCode: 1,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 0,
      stderrBytes: 50,
      executionTimeMs: 200,
    };

    emitError(state, context, 'fatal', summary);

    expect(withEventEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', error: 'fatal', summary }),
      'stream-test',
      1
    );
  });

  it('GIVEN pending flush with queued stderr WHEN called THEN flushes chunks before emitting error', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stderr', 'buffered error', context);

    emitError(state, context, 'fatal error');

    expect(state.queuedStderr).toBe('');
    expect(state.emittedChunks).toBe(1);
    expect(context.extra.sendNotification).toHaveBeenCalledTimes(2);
  });

  it('GIVEN pending flush WHEN called THEN clears flush timer', () => {
    const state = makeState();
    const context = makeContext();

    queueChunk(state, 'stderr', 'data', context);

    expect(state.flushTimer).toBeDefined();

    emitError(state, context, 'err');

    expect(state.flushTimer).toBeUndefined();
  });
});

describe('emitEvent (internal, via exported functions)', () => {
  it('GIVEN multiple calls WHEN emitting THEN sequence increments for each', () => {
    const state = makeState();
    const context = makeContext();

    emitSystemEvent(state, context, 'start');
    emitSystemEvent(state, context, 'heartbeat');

    expect(state.sequence).toBe(3);
    expect(withEventEnvelope).toHaveBeenNthCalledWith(1, expect.anything(), 'stream-test', 1);
    expect(withEventEnvelope).toHaveBeenNthCalledWith(2, expect.anything(), 'stream-test', 2);
  });

  it('GIVEN active state WHEN emitting THEN sends notification with correct payload structure', () => {
    const state = makeState();
    const context = makeContext();

    emitSystemEvent(state, context, 'start');

    const envelope = vi.mocked(withEventEnvelope).mock.results[0]?.value as unknown;

    expect(context.extra.sendNotification).toHaveBeenCalledWith({
      method: 'notifications/progress',
      params: {
        progressToken: 42,
        progress: 1,
        message: JSON.stringify(envelope),
      },
    });
  });
});
