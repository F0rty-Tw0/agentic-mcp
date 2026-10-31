import { describe, expect, it, vi } from 'vitest';

import { holdStreamError } from './held-error-notifier';
import type { AskStreamExecutionSummary, StreamNotifier } from '../common';

const SUMMARY: AskStreamExecutionSummary = {
  exitCode: 1,
  signal: null,
  timedOut: false,
  truncated: false,
  stdoutBytes: 0,
  stderrBytes: 10,
  executionTimeMs: 5,
};

const createNotifier = (): StreamNotifier => {
  const streamNotifier: StreamNotifier = {
    onStdoutChunk: vi.fn(),
    onStderrChunk: vi.fn(),
    emitStart: vi.fn(),
    emitDone: vi.fn(),
    emitError: vi.fn(),
    flush: vi.fn(),
    stop: vi.fn(),
    enabled: true,
  };

  return streamNotifier;
};

describe('FEATURE: holdStreamError', () => {
  describe('GIVEN an error emitted through the held notifier', () => {
    it('WHEN it is not released THEN the wrapped notifier gets no error', () => {
      const streamNotifier = createNotifier();
      const { notifier } = holdStreamError(streamNotifier);

      notifier.emitError('boom', SUMMARY);

      expect(streamNotifier.emitError).not.toHaveBeenCalled();
    });

    it('WHEN it is held THEN queued chunks are flushed', () => {
      const streamNotifier = createNotifier();
      const { notifier } = holdStreamError(streamNotifier);

      notifier.emitError('boom', SUMMARY);

      expect(streamNotifier.flush).toHaveBeenCalledTimes(1);
    });

    it('WHEN it is released THEN the wrapped notifier gets the error and summary', () => {
      const streamNotifier = createNotifier();
      const { notifier, releaseError } = holdStreamError(streamNotifier);

      notifier.emitError('boom', SUMMARY);
      releaseError();

      expect(streamNotifier.emitError).toHaveBeenCalledWith('boom', SUMMARY);
    });

    it('WHEN it is released twice THEN the error is sent once', () => {
      const streamNotifier = createNotifier();
      const { notifier, releaseError } = holdStreamError(streamNotifier);

      notifier.emitError('boom', SUMMARY);
      releaseError();
      releaseError();

      expect(streamNotifier.emitError).toHaveBeenCalledTimes(1);
    });
  });

  describe('GIVEN no error emitted', () => {
    it('WHEN released THEN the wrapped notifier gets no error', () => {
      const streamNotifier = createNotifier();
      const { releaseError } = holdStreamError(streamNotifier);

      releaseError();

      expect(streamNotifier.emitError).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a chunk sent through the held notifier', () => {
    it('WHEN sent THEN it reaches the wrapped notifier', () => {
      const streamNotifier = createNotifier();
      const { notifier } = holdStreamError(streamNotifier);

      notifier.onStderrChunk('partial');

      expect(streamNotifier.onStderrChunk).toHaveBeenCalledWith('partial');
    });
  });
});
