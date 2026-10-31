import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPendingChunks, queueChunk } from './notifier-runtime';
import type { ProgressContext, ProgressToken } from '../../shared';
import type { NotifierState } from '../common';
import { NOTIFIER_STATE_STUB } from '../test/stubs/streaming.stub';

type EmitterContext = {
  readonly extra: ProgressContext;
  readonly progressToken: ProgressToken;
};

const makeContext = (): EmitterContext => {
  const sendNotification = vi.fn().mockResolvedValue(undefined);
  const extra = { sendNotification };
  const emitterContext: EmitterContext = { extra, progressToken: 42 };

  return emitterContext;
};

const makeState = (): NotifierState => {
  const notifierState: NotifierState = { ...NOTIFIER_STATE_STUB };

  return notifierState;
};

describe('FEATURE: flushPendingChunks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN a queued stderr chunk', () => {
    it('WHEN flushed THEN the chunk is sent at once', () => {
      const state = makeState();
      const context = makeContext();

      queueChunk(state, 'stderr', 'partial output', context);
      flushPendingChunks(state, context);

      expect(context.extra.sendNotification).toHaveBeenCalledTimes(1);
    });

    it('WHEN flushed THEN the flush timer is cleared', () => {
      const state = makeState();
      const context = makeContext();

      queueChunk(state, 'stderr', 'partial output', context);
      flushPendingChunks(state, context);

      expect(state.flushTimer).toBeUndefined();
    });
  });

  describe('GIVEN nothing queued', () => {
    it('WHEN flushed THEN nothing is sent', () => {
      const state = makeState();
      const context = makeContext();

      flushPendingChunks(state, context);

      expect(context.extra.sendNotification).not.toHaveBeenCalled();
    });
  });
});
