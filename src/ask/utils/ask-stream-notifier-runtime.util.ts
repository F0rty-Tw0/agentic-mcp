import { buildStreamDiagnostics, splitChunkByBytes, withEventEnvelope } from './ask-stream-notifier.helpers';
import type { AskStreamEventPayload, ProgressToken } from './ask-stream-notifier.helpers';
import type { ProgressContext } from '../../shared/common';
import { STREAM_COALESCE_WINDOW_MS } from '../common';
import type { AskStreamChannel, AskStreamExecutionSummary } from '../common';

export type NotifierState = {
  streamId: string;
  sequence: number;
  emittedChunks: number;
  droppedChunks: number;
  coalescedChunks: number;
  queuedStdout: string;
  queuedStderr: string;
  lastChunkAtMs: number;
  stopped: boolean;
  flushTimer?: NodeJS.Timeout;
};

type EmitterContext = Readonly<{
  extra: ProgressContext;
  progressToken: ProgressToken;
}>;

const emitEvent = (state: NotifierState, context: EmitterContext, event: AskStreamEventPayload): void => {
  if (state.stopped) return;

  const payload = withEventEnvelope(event, state.streamId, state.sequence);
  const currentSequence = state.sequence;

  state.sequence += 1;

  void context.extra
    .sendNotification({
      method: 'notifications/progress',
      params: {
        progressToken: context.progressToken,
        progress: currentSequence,
        message: JSON.stringify(payload),
      },
    })
    .catch(() => {
      if (payload.type === 'chunk') state.droppedChunks += 1;
    });
};

const flushQueuedChunks = (state: NotifierState, context: EmitterContext): void => {
  state.flushTimer = undefined;

  for (const part of splitChunkByBytes(state.queuedStdout)) {
    state.emittedChunks += 1;
    emitEvent(state, context, { type: 'chunk', channel: 'stdout', chunk: part });
  }

  for (const part of splitChunkByBytes(state.queuedStderr)) {
    state.emittedChunks += 1;
    emitEvent(state, context, { type: 'chunk', channel: 'stderr', chunk: part });
  }

  state.queuedStdout = '';
  state.queuedStderr = '';
};

export const queueChunk = (
  state: NotifierState,
  channel: AskStreamChannel,
  chunk: string,
  context: EmitterContext
): void => {
  if (chunk.length === 0) return;

  state.lastChunkAtMs = Date.now();

  if (channel === 'stdout') {
    if (state.queuedStdout.length > 0) state.coalescedChunks += 1;
    state.queuedStdout += chunk;
  } else {
    if (state.queuedStderr.length > 0) state.coalescedChunks += 1;
    state.queuedStderr += chunk;
  }

  state.flushTimer ??= setTimeout(() => {
    flushQueuedChunks(state, context);
  }, STREAM_COALESCE_WINDOW_MS);
};

export const emitSystemEvent = (state: NotifierState, context: EmitterContext, type: 'start' | 'heartbeat'): void => {
  emitEvent(state, context, { type, channel: 'system' });
};

export const emitDone = (state: NotifierState, context: EmitterContext, summary: AskStreamExecutionSummary): void => {
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    flushQueuedChunks(state, context);
  }

  emitEvent(state, context, {
    type: 'done',
    channel: 'system',
    summary,
    diagnostics: buildStreamDiagnostics(state),
  });
};

export const emitError = (
  state: NotifierState,
  context: EmitterContext,
  error: string,
  summary?: AskStreamExecutionSummary
): void => {
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    flushQueuedChunks(state, context);
  }

  emitEvent(state, context, {
    type: 'error',
    channel: 'system',
    error,
    summary,
    diagnostics: buildStreamDiagnostics(state),
  });
};
