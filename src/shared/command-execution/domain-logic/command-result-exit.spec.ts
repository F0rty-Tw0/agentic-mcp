import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupResultExitWatch } from './command-result-exit';
import { killProcess } from './platform';
import { RESULT_EXIT_GRACE_MS } from '../common';

vi.mock('./platform', () => {
  const killProcessMock = vi.fn().mockResolvedValue(undefined);
  const mockedModule = {
    killProcess: killProcessMock,
  };

  return mockedModule;
});

const killProcessMock = vi.mocked(killProcess);

const isResultChunk = (chunk: string): boolean => chunk.includes('RESULT');

describe('FEATURE: stop a child that does not exit after its result', () => {
  beforeEach(() => {
    killProcessMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN a watch with a result detector', () => {
    describe('WHEN a complete result is seen and the grace period elapses', () => {
      it('THEN the child is killed', async () => {
        const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, 4321);

        watch.observe('RESULT');
        await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS);

        expect(killProcessMock).toHaveBeenCalledWith(4321);
      });

      it('THEN the watch reports that it stopped the child', async () => {
        const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, 4321);

        watch.observe('RESULT');
        await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS);

        expect(watch.stopped()).toBe(true);
      });
    });

    it('WHEN the child exits within the grace period THEN it is not killed', async () => {
      const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, 4321);

      watch.observe('RESULT');
      await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS - 1);
      watch.clear();
      await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS);

      expect(killProcessMock).not.toHaveBeenCalled();
    });

    it('WHEN only partial output is seen THEN the child is not killed', async () => {
      const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, 4321);

      watch.observe('step');
      await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS * 2);

      expect(watch.stopped()).toBe(false);
    });

    it('WHEN more output follows the result THEN the detector is not asked again', () => {
      const detector = vi.fn(isResultChunk);
      const watch = setupResultExitWatch({ isResultComplete: detector }, 4321);

      watch.observe('RESULT');
      watch.observe('trailing');

      expect(detector).toHaveBeenCalledOnce();
    });
  });

  describe('GIVEN a watch with a custom grace period', () => {
    it('WHEN that period elapses after the result THEN the child is killed', async () => {
      const watch = setupResultExitWatch({ isResultComplete: isResultChunk, resultExitGraceMs: 200 }, 4321);

      watch.observe('RESULT');
      await vi.advanceTimersByTimeAsync(200);

      expect(killProcessMock).toHaveBeenCalledWith(4321);
    });

    it('WHEN that period has not elapsed THEN the child is not killed', async () => {
      const watch = setupResultExitWatch({ isResultComplete: isResultChunk, resultExitGraceMs: 200 }, 4321);

      watch.observe('RESULT');
      await vi.advanceTimersByTimeAsync(199);

      expect(killProcessMock).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a watch without a result detector', () => {
    it('WHEN output arrives THEN the child is never killed', async () => {
      const watch = setupResultExitWatch({}, 4321);

      watch.observe('RESULT');
      await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS * 2);

      expect(killProcessMock).not.toHaveBeenCalled();
    });
  });

  it('GIVEN a child without a pid WHEN a result is seen THEN the child is never killed', async () => {
    const watch = setupResultExitWatch({ isResultComplete: isResultChunk }, undefined);

    watch.observe('RESULT');
    await vi.advanceTimersByTimeAsync(RESULT_EXIT_GRACE_MS * 2);

    expect(killProcessMock).not.toHaveBeenCalled();
  });
});
