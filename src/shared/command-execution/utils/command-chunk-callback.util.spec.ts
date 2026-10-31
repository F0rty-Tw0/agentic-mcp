import { describe, expect, it, vi } from 'vitest';

import { wrapChunkCallback, wrapStdoutCallback } from './command-chunk-callback.util';
import { idleTimeoutHandleMock, resultExitWatchMock } from '../test/mocks/command-chunk.mock';

describe('FEATURE: command chunk callbacks', () => {
  describe('GIVEN a stderr chunk callback', () => {
    it('WHEN a chunk arrives THEN the idle timer is reset', () => {
      const idleTimeout = idleTimeoutHandleMock();
      const onChunk = wrapChunkCallback(idleTimeout);

      onChunk('err');

      expect(idleTimeout.reset).toHaveBeenCalledOnce();
    });

    it('WHEN a chunk arrives THEN the caller callback receives it', () => {
      const callback = vi.fn();
      const onChunk = wrapChunkCallback(idleTimeoutHandleMock(), callback);

      onChunk('err');

      expect(callback).toHaveBeenCalledWith('err');
    });
  });

  describe('GIVEN a stdout chunk callback', () => {
    it('WHEN a chunk arrives THEN the result exit watch observes it', () => {
      const resultExitWatch = resultExitWatchMock();
      const onChunk = wrapStdoutCallback(idleTimeoutHandleMock(), resultExitWatch);

      onChunk('out');

      expect(resultExitWatch.observe).toHaveBeenCalledWith('out');
    });

    it('WHEN a chunk arrives THEN the caller callback receives it', () => {
      const callback = vi.fn();
      const onChunk = wrapStdoutCallback(idleTimeoutHandleMock(), resultExitWatchMock(), callback);

      onChunk('out');

      expect(callback).toHaveBeenCalledWith('out');
    });
  });
});
