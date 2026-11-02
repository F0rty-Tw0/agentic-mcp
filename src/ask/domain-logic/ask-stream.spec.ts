import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withAskStream } from './ask-stream';
import type * as streamingModule from '../../streaming';
import type { StreamNotifier } from '../../streaming/common';
import type { AskToolArgs } from '../common';
import { ASK_RESOLVED_PROVIDER_ENTRY_STUB } from '../test/stubs/ask-resolved-provider-entry.stub';

const ASK_ARGS: AskToolArgs = { prompt: 'hi', stream_live: true };

const { liveNotifier, stopHeartbeat } = vi.hoisted(() => {
  const notifier: StreamNotifier = {
    onStdoutChunk: vi.fn(),
    onStderrChunk: vi.fn(),
    emitStart: vi.fn(),
    emitDone: vi.fn(),
    emitError: vi.fn(),
    flush: vi.fn(),
    stop: vi.fn(),
    enabled: true,
  };
  const hoisted = { liveNotifier: notifier, stopHeartbeat: vi.fn() };

  return hoisted;
});

vi.mock('../../streaming', async (importOriginal) => {
  const actual = await importOriginal<typeof streamingModule>();
  const result = { ...actual, createStreamNotifier: vi.fn(() => liveNotifier) };

  return result;
});

vi.mock('./ask-heartbeat', () => {
  const result = { startAskHeartbeat: vi.fn(() => stopHeartbeat) };

  return result;
});

const runInStream = async (run: (streamNotifier: StreamNotifier) => Promise<string>): Promise<string> => {
  const result = await withAskStream({ context: ASK_RESOLVED_PROVIDER_ENTRY_STUB, args: ASK_ARGS }, run);

  return result;
};

const finishRun = async (): Promise<string> => {
  const result = await Promise.resolve('finished');

  return result;
};

const failRun = async (): Promise<string> => {
  await Promise.resolve();

  throw new Error('run failed');
};

describe('FEATURE: withAskStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GIVEN a run that finishes', () => {
    it('WHEN the stream wraps it THEN the run gets the live notifier', async () => {
      const run = vi.fn(finishRun);

      await runInStream(run);

      expect(run).toHaveBeenCalledExactlyOnceWith(liveNotifier);
    });

    it('WHEN the stream wraps it THEN the run result reaches the caller', async () => {
      const result = await runInStream(finishRun);

      expect(result).toBe('finished');
    });

    it('WHEN the stream wraps it THEN the notifier stops once', async () => {
      await runInStream(finishRun);

      expect(liveNotifier.stop).toHaveBeenCalledOnce();
    });

    it('WHEN the stream wraps it THEN the heartbeat stops once', async () => {
      await runInStream(finishRun);

      expect(stopHeartbeat).toHaveBeenCalledOnce();
    });
  });

  describe('GIVEN a run that throws', () => {
    it('WHEN the stream wraps it THEN the error reaches the caller', async () => {
      await expect(runInStream(failRun)).rejects.toThrow('run failed');
    });

    it('WHEN the stream wraps it THEN the notifier still stops', async () => {
      await runInStream(failRun).catch(() => '');

      expect(liveNotifier.stop).toHaveBeenCalledOnce();
    });

    it('WHEN the stream wraps it THEN the heartbeat still stops', async () => {
      await runInStream(failRun).catch(() => '');

      expect(stopHeartbeat).toHaveBeenCalledOnce();
    });
  });
});
