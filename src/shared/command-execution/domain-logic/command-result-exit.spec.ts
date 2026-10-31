import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupResultExitWatch } from './command-result-exit';
import { RESULT_EXIT_GRACE_MS } from '../common';
import type { StopChild } from '../common';

const stopChildMock = vi.fn<StopChild>();

const isResultChunk = (chunk: string): boolean => chunk.includes('RESULT');

describe('FEATURE: stop a child that does not exit after its result', () => {
  beforeEach(() => {
    stopChildMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN a watch with a result detector', () => {
    describe('WHEN a complete result is seen and the grace period elapses', () => {
      it('THEN the child is killed', async () => {
        const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, stopChildMock);

        watch.observe('RESULT');
        await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS);

        expect(stopChildMock).toHaveBeenCalledOnce();
      });

      it('THEN the watch reports that it stopped the child', async () => {
        const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, stopChildMock);

        watch.observe('RESULT');
        await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS);

        expect(watch.stopped()).toBe(true);
      });
    });

    it('WHEN the child exits within the grace period THEN it is not killed', async () => {
      const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, stopChildMock);

      watch.observe('RESULT');
      await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS - 1);
      watch.clear();
      await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS);

      expect(stopChildMock).not.toHaveBeenCalled();
    });

    it('WHEN only partial output is seen THEN the child is not killed', async () => {
      const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, stopChildMock);

      watch.observe('step');
      await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS * 2);

      expect(watch.stopped()).toBe(false);
    });

    it('WHEN more output follows the result THEN the detector is not asked again', () => {
      const detector = vi.fn(isResultChunk);
      const watch = setupResultExitWatch({ isResultComplete: detector }, stopChildMock);

      watch.observe('RESULT');
      watch.observe('trailing');

      expect(detector).toHaveBeenCalledOnce();
    });
  });

  describe('GIVEN a watch with a custom grace period', () => {
    it('WHEN that period elapses after the result THEN the child is killed', async () => {
      const watch = setupResultExitWatch({ isResultComplete: isResultChunk, resultExitGraceMs: 200 }, stopChildMock);

      watch.observe('RESULT');
      await vi.advanceTimersByTimeAsync(200);

      expect(stopChildMock).toHaveBeenCalledOnce();
    });

    it('WHEN that period has not elapsed THEN the child is not killed', async () => {
      const watch = setupResultExitWatch({ isResultComplete: isResultChunk, resultExitGraceMs: 200 }, stopChildMock);

      watch.observe('RESULT');
      await vi.advanceTimersByTimeAsync(199);

      expect(stopChildMock).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a watch without a result detector', () => {
    it('WHEN output arrives THEN the child is never killed', async () => {
      const watch = setupResultExitWatch({}, stopChildMock);

      watch.observe('RESULT');
      await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS * 2);

      expect(stopChildMock).not.toHaveBeenCalled();
    });
  });

  it('GIVEN no stop action WHEN a result is seen THEN the child is never killed', async () => {
    const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, undefined);

    watch.observe('RESULT');
    await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS * 2);

    expect(stopChildMock).not.toHaveBeenCalled();
  });
});
