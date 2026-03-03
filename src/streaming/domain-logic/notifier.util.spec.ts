/* eslint-disable @typescript-eslint/naming-convention */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitDone, emitError, emitSystemEvent, queueChunk } from './notifier-runtime.util';
import { createNoopStreamNotifier, isStreamEnabled, resolveProgressToken } from './notifier.helpers';
import type { StreamNotifier } from './notifier.helpers';
import { createStreamNotifier } from './notifier.util';
import type { ProgressContext } from '../../shared';
import { HEARTBEAT_IDLE_INTERVAL_MS } from '../common';

vi.mock('./notifier-runtime.util');
vi.mock('./notifier.helpers');
vi.mock('node:crypto', () => ({ randomUUID: (): string => 'test-uuid-1234' }));

const noopNotifier: StreamNotifier = {
  onStdoutChunk: vi.fn(),
  onStderrChunk: vi.fn(),
  emitStart: vi.fn(),
  emitDone: vi.fn(),
  emitError: vi.fn(),
  stop: vi.fn(),
  enabled: false,
};

const makeExtra = (): ProgressContext => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  _meta: { progressToken: 42 },
});

describe('createStreamNotifier', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(createNoopStreamNotifier).mockReturnValue(noopNotifier);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('GIVEN streaming is disabled', () => {
    beforeEach(() => {
      vi.mocked(resolveProgressToken).mockReturnValue(undefined);
      vi.mocked(isStreamEnabled).mockReturnValue(false);
    });

    it('WHEN called without extra THEN returns noop notifier', () => {
      const result = createStreamNotifier({ providerName: 'test', args: {} });

      expect(result).toBe(noopNotifier);
    });

    it('WHEN called with stream_live=false THEN returns noop notifier', () => {
      const result = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: false },
        extra: makeExtra(),
      });

      expect(result).toBe(noopNotifier);
    });
  });

  describe('GIVEN progressToken resolves but isStreamEnabled is false', () => {
    it('WHEN called THEN returns noop notifier', () => {
      vi.mocked(resolveProgressToken).mockReturnValue(42);
      vi.mocked(isStreamEnabled).mockReturnValue(false);

      const result = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: false },
        extra: makeExtra(),
      });

      expect(result).toBe(noopNotifier);
    });
  });

  describe('GIVEN streaming is enabled', () => {
    let extra: ProgressContext;

    beforeEach(() => {
      extra = makeExtra();
      vi.mocked(resolveProgressToken).mockReturnValue(42);
      vi.mocked(isStreamEnabled).mockReturnValue(true);
    });

    it('WHEN called THEN returns notifier with enabled=true', () => {
      const notifier = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: true },
        extra,
      });

      expect(notifier.enabled).toBe(true);
      notifier.stop();
    });

    it('WHEN onStdoutChunk called THEN delegates to queueChunk with stdout channel', () => {
      const notifier = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: true },
        extra,
      });

      notifier.onStdoutChunk('hello');
      notifier.stop();

      expect(queueChunk).toHaveBeenCalledWith(
        expect.objectContaining({ streamId: 'ask-test-test-uuid-1234' }),
        'stdout',
        'hello',
        expect.objectContaining({ extra, progressToken: 42 })
      );
    });

    it('WHEN onStderrChunk called THEN delegates to queueChunk with stderr channel', () => {
      const notifier = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: true },
        extra,
      });

      notifier.onStderrChunk('error text');
      notifier.stop();

      expect(queueChunk).toHaveBeenCalledWith(
        expect.objectContaining({ streamId: 'ask-test-test-uuid-1234' }),
        'stderr',
        'error text',
        expect.objectContaining({ extra, progressToken: 42 })
      );
    });

    it('WHEN emitStart called THEN delegates to emitSystemEvent with start type', () => {
      const notifier = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: true },
        extra,
      });

      notifier.emitStart();
      notifier.stop();

      expect(emitSystemEvent).toHaveBeenCalledWith(
        expect.objectContaining({ streamId: 'ask-test-test-uuid-1234' }),
        expect.objectContaining({ extra, progressToken: 42 }),
        'start'
      );
    });

    it('WHEN emitDone called THEN delegates to runtime emitDone with summary', () => {
      const notifier = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: true },
        extra,
      });
      const summary = {
        exitCode: 0,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 100,
        stderrBytes: 0,
        executionTimeMs: 500,
      };

      notifier.emitDone(summary);
      notifier.stop();

      expect(emitDone).toHaveBeenCalledWith(
        expect.objectContaining({ streamId: 'ask-test-test-uuid-1234' }),
        expect.objectContaining({ extra, progressToken: 42 }),
        summary
      );
    });

    it('WHEN emitError called THEN delegates to runtime emitError', () => {
      const notifier = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: true },
        extra,
      });
      const summary = {
        exitCode: 1,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 50,
        executionTimeMs: 200,
      };

      notifier.emitError('something failed', summary);
      notifier.stop();

      expect(emitError).toHaveBeenCalledWith(
        expect.objectContaining({ streamId: 'ask-test-test-uuid-1234' }),
        expect.objectContaining({ extra, progressToken: 42 }),
        'something failed',
        summary
      );
    });

    it('WHEN stop called THEN does not emit heartbeat after idle threshold', () => {
      const notifier = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: true },
        extra,
      });

      notifier.stop();
      vi.advanceTimersByTime(HEARTBEAT_IDLE_INTERVAL_MS * 2);

      expect(emitSystemEvent).not.toHaveBeenCalled();
    });

    it('WHEN idle time exceeds heartbeat threshold THEN emits heartbeat event', () => {
      const notifier = createStreamNotifier({
        providerName: 'test',
        args: { stream_live: true },
        extra,
      });

      vi.advanceTimersByTime(HEARTBEAT_IDLE_INTERVAL_MS);
      notifier.stop();

      expect(emitSystemEvent).toHaveBeenCalledWith(
        expect.objectContaining({ streamId: 'ask-test-test-uuid-1234' }),
        expect.objectContaining({ extra, progressToken: 42 }),
        'heartbeat'
      );
    });
  });
});
