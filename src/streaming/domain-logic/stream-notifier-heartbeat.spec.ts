import type { ServerNotification } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStreamNotifier } from './stream-notifier.builder';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { StreamNotifier } from '../common';

const MAX_PROGRESS_GAP_MS = 20_000;
const MIN_HEARTBEAT_SPACING_MS = 15_000;
const RUN_DURATION_MS = 120_000;
const CHUNK_DELAY_MS = 4_900;

type ProgressLog = {
  readonly sentAtMs: number[];
  readonly heartbeatAtMs: number[];
};

const isHeartbeat = (notification: ServerNotification): boolean => {
  if (notification.method !== 'notifications/progress') return false;

  const message = notification.params.message ?? '';
  const isHeartbeatMessage = message.includes('"type":"heartbeat"');

  return isHeartbeatMessage;
};

const buildRecordingContext = (progressLog: ProgressLog): ProgressContext => {
  const sendNotification = async (notification: ServerNotification): Promise<void> => {
    const nowMs = Date.now();
    const heartbeatSent = isHeartbeat(notification);

    progressLog.sentAtMs.push(nowMs);

    if (heartbeatSent) progressLog.heartbeatAtMs.push(nowMs);

    await Promise.resolve();
  };
  const meta = { progressToken: 'token-1' };
  const progressContext: ProgressContext = { sendNotification, ['_meta']: meta };

  return progressContext;
};

const toGaps = (timesMs: number[]): number[] => {
  const gaps = timesMs.slice(1).map((timeMs, index) => timeMs - (timesMs[index] ?? timeMs));

  return gaps;
};

const runStreamWithEarlyChunk = async (progressLog: ProgressLog): Promise<void> => {
  const args = { stream_live: true };
  const notifier: StreamNotifier = createStreamNotifier({
    providerName: 'test',
    args,
    extra: buildRecordingContext(progressLog),
  });

  notifier.emitStart();
  await vi.advanceTimersByTimeAsync(CHUNK_DELAY_MS);
  notifier.onStdoutChunk('partial output');
  await vi.advanceTimersByTimeAsync(RUN_DURATION_MS);
  notifier.stop();
};

describe('FEATURE: live stream heartbeat spacing', () => {
  let progressLog: ProgressLog;

  beforeEach(() => {
    vi.useFakeTimers();
    progressLog = { sentAtMs: [], heartbeatAtMs: [] };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN a live stream whose output stops shortly after it starts', () => {
    it('WHEN the call keeps running for 2 minutes THEN no two progress notifications are more than 20 s apart', async () => {
      await runStreamWithEarlyChunk(progressLog);

      const gapsMs = toGaps(progressLog.sentAtMs);
      const longestGapMs = Math.max(...gapsMs);

      expect(longestGapMs).toBeLessThanOrEqual(MAX_PROGRESS_GAP_MS);
    });

    it('WHEN the call keeps running for 2 minutes THEN heartbeats are at least 15 s apart', async () => {
      await runStreamWithEarlyChunk(progressLog);

      const heartbeatGapsMs = toGaps(progressLog.heartbeatAtMs);
      const shortestHeartbeatGapMs = Math.min(...heartbeatGapsMs);

      expect(shortestHeartbeatGapMs).toBeGreaterThanOrEqual(MIN_HEARTBEAT_SPACING_MS);
    });
  });
});
