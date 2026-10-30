import { randomUUID } from 'node:crypto';

import type { ProgressContext } from '../../shared/mcp-protocol/common';
import { HEARTBEAT_IDLE_INTERVAL_MS, STREAM_PROGRESS_START } from '../common';
import type { AskStreamExecutionSummary, NotifierState, StreamNotifier } from '../common';
import { emitDone, emitError, emitSystemEvent, queueChunk } from './notifier-runtime';
import { createNoopStreamNotifier, isStreamEnabled, resolveProgressToken } from '../utils/notifier.helpers';

type StreamLiveArgs = { readonly stream_live?: boolean };

type CreateStreamNotifierInput = {
  readonly providerName: string;
  readonly args: StreamLiveArgs;
  readonly extra?: ProgressContext;
};

export const createStreamNotifier = (input: CreateStreamNotifierInput): StreamNotifier => {
  const progressToken = resolveProgressToken(input.extra);

  const isEnabled = isStreamEnabled({ args: input.args, progressToken, extra: input.extra });

  if (!isEnabled || progressToken === undefined || !input.extra) return createNoopStreamNotifier();

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
    const nowMs = Date.now();
    const idleMs = nowMs - state.lastChunkAtMs;

    if (idleMs < HEARTBEAT_IDLE_INTERVAL_MS) return;

    emitSystemEvent(state, context, 'heartbeat');
  }, HEARTBEAT_IDLE_INTERVAL_MS);

  const streamNotifier: StreamNotifier = {
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

  return streamNotifier;
};
