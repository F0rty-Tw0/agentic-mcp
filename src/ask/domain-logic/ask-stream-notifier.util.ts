import { randomUUID } from 'node:crypto';

import { emitDone, emitError, emitSystemEvent, queueChunk } from './ask-stream-notifier-runtime.util.ts';
import type { NotifierState } from './ask-stream-notifier-runtime.util.ts';
import {
  buildExecutionSummary,
  createNoopStreamNotifier,
  isStreamEnabled,
  resolveProgressToken,
} from './ask-stream-notifier.helpers.ts';
import type { StreamNotifier } from './ask-stream-notifier.helpers.ts';
import { HEARTBEAT_IDLE_INTERVAL_MS, STREAM_PROGRESS_START } from '../common/index.ts';
import type { AskStreamExecutionSummary, AskToolArgs, ProgressContext } from '../common/index.ts';

export const createStreamNotifier = (input: {
  providerName: string;
  args: AskToolArgs;
  extra?: ProgressContext;
}): StreamNotifier => {
  const progressToken = resolveProgressToken(input.extra);

  if (!isStreamEnabled({ args: input.args, progressToken, extra: input.extra }) || !progressToken || !input.extra) {
    return createNoopStreamNotifier();
  }

  const state: NotifierState = {
    streamId: `ask-${input.providerName}-${randomUUID()}`,
    sequence: STREAM_PROGRESS_START,
    emittedChunks: 0,
    droppedChunks: 0,
    coalescedChunks: 0,
    queuedStdout: '',
    queuedStderr: '',
    lastChunkAtMs: Date.now(),
    stopped: false,
    flushTimer: undefined,
  };
  const context = { extra: input.extra, progressToken };

  const heartbeatTimer = setInterval(() => {
    if (Date.now() - state.lastChunkAtMs < HEARTBEAT_IDLE_INTERVAL_MS) return;

    emitSystemEvent(state, context, 'heartbeat');
  }, HEARTBEAT_IDLE_INTERVAL_MS);

  return {
    onStdoutChunk: (chunk: string): void => {
      queueChunk(state, 'stdout', chunk, context);
    },
    onStderrChunk: (chunk: string): void => {
      queueChunk(state, 'stderr', chunk, context);
    },
    emitStart: (): void => {
      emitSystemEvent(state, context, 'start');
    },
    emitDone: (summary: AskStreamExecutionSummary): void => {
      emitDone(state, context, summary);
    },
    emitError: (error: string, summary?: AskStreamExecutionSummary): void => {
      emitError(state, context, error, summary);
    },
    stop: (): void => {
      state.stopped = true;

      clearInterval(heartbeatTimer);

      if (state.flushTimer) clearTimeout(state.flushTimer);
    },
    enabled: true,
  };
};

export { buildExecutionSummary };
