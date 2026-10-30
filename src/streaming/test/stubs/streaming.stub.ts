import type { AskStreamDiagnostics, NotifierState } from '../../common/stream-event.type';

export const ASK_STREAM_DIAGNOSTICS_STUB: AskStreamDiagnostics = {
  streamId: 'stream-test',
  lastSequence: 0,
  emittedChunks: 0,
  droppedChunks: 0,
  coalescedChunks: 0,
  terminalEventGraceTimeoutMs: 5_000,
};

export const NOTIFIER_STATE_STUB: NotifierState = {
  streamId: 'stream-test',
  sequence: 1,
  emittedChunks: 0,
  droppedChunks: 0,
  coalescedChunks: 0,
  queuedStdout: '',
  queuedStderr: '',
  lastChunkAtMs: 0,
  stopped: false,
  flushTimer: undefined,
};
