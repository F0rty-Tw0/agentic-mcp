import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startAskHeartbeat } from './ask-heartbeat';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { StreamNotifier } from '../../streaming/common';

type SendNotification = NonNullable<ProgressContext['sendNotification']>;

const buildStreamNotifier = (enabled: boolean): StreamNotifier => {
  const streamNotifier: StreamNotifier = {
    onStdoutChunk: vi.fn(),
    onStderrChunk: vi.fn(),
    emitStart: vi.fn(),
    emitDone: vi.fn(),
    emitError: vi.fn(),
    stop: vi.fn(),
    enabled,
  };

  return streamNotifier;
};

const buildProgressContext = (sendNotification: SendNotification): ProgressContext => {
  const meta = { progressToken: 'token-1' };
  const progressContext: ProgressContext = {
    sendNotification,
    ['_meta']: meta,
  };

  return progressContext;
};

describe('FEATURE: startAskHeartbeat', () => {
  let sendNotification: SendNotification;

  beforeEach(() => {
    vi.useFakeTimers();
    sendNotification = vi.fn(async () => Promise.resolve());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('GIVEN live streaming is off and the client sent a progress token', () => {
    it('WHEN the heartbeat starts THEN a progress notification is sent', () => {
      const stopHeartbeat = startAskHeartbeat(buildStreamNotifier(false), buildProgressContext(sendNotification));

      stopHeartbeat();

      expect(sendNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('GIVEN live streaming is on', () => {
    it('WHEN the heartbeat starts and 60 s pass THEN it sends nothing because the stream sends its own heartbeat', () => {
      const stopHeartbeat = startAskHeartbeat(buildStreamNotifier(true), buildProgressContext(sendNotification));

      vi.advanceTimersByTime(60_000);
      stopHeartbeat();

      expect(sendNotification).not.toHaveBeenCalled();
    });
  });
});
