export type AskStreamEventSchema = 'agentic-mcp.ask.stream.v1';

export type AskStreamEventType = 'start' | 'chunk' | 'heartbeat' | 'done' | 'error';

export type AskStreamChannel = 'stdout' | 'stderr' | 'system';

export type AskStreamExecutionSummary = {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  readonly truncated: boolean;
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
  readonly executionTimeMs: number;
};

export type AskStreamDiagnostics = {
  readonly streamId: string;
  readonly lastSequence: number;
  readonly emittedChunks: number;
  readonly droppedChunks: number;
  readonly coalescedChunks: number;
  readonly terminalEventGraceTimeoutMs: number;
};

type AskStreamStartPayload = {
  readonly type: 'start';
  readonly channel: 'system';
};

type AskStreamHeartbeatPayload = {
  readonly type: 'heartbeat';
  readonly channel: 'system';
};

type AskStreamChunkPayload = {
  readonly type: 'chunk';
  readonly channel: AskStreamChannel;
  readonly chunk: string;
};

type AskStreamDonePayload = {
  readonly type: 'done';
  readonly channel: 'system';
  readonly summary: AskStreamExecutionSummary;
  readonly diagnostics: AskStreamDiagnostics;
};

type AskStreamErrorPayload = {
  readonly type: 'error';
  readonly channel: 'system';
  readonly error: string;
  readonly summary?: AskStreamExecutionSummary;
  readonly diagnostics: AskStreamDiagnostics;
};

export type AskStreamEventPayload =
  | AskStreamStartPayload
  | AskStreamHeartbeatPayload
  | AskStreamChunkPayload
  | AskStreamDonePayload
  | AskStreamErrorPayload;

export type StreamNotifier = {
  readonly onStdoutChunk: (chunk: string) => void;
  readonly onStderrChunk: (chunk: string) => void;
  readonly emitStart: () => void;
  readonly emitDone: (summary: AskStreamExecutionSummary) => void;
  readonly emitError: (error: string, summary?: AskStreamExecutionSummary) => void;
  readonly stop: () => void;
  readonly enabled: boolean;
};

export type NotifierState = {
  readonly streamId: string;
  // eslint-disable-next-line local/readonly-type-properties -- advanced in place for every emitted event
  sequence: number;
  // eslint-disable-next-line local/readonly-type-properties -- counted in place by the notifier runtime
  emittedChunks: number;
  // eslint-disable-next-line local/readonly-type-properties -- counted in place by the notifier runtime
  droppedChunks: number;
  // eslint-disable-next-line local/readonly-type-properties -- counted in place by the notifier runtime
  coalescedChunks: number;
  // eslint-disable-next-line local/readonly-type-properties -- chunk buffer appended and flushed in place
  queuedStdout: string;
  // eslint-disable-next-line local/readonly-type-properties -- chunk buffer appended and flushed in place
  queuedStderr: string;
  // eslint-disable-next-line local/readonly-type-properties -- refreshed in place on every sent notification
  lastEmitAtMs: number;
  // eslint-disable-next-line local/readonly-type-properties -- set in place when the notifier stops
  stopped: boolean;
  flushTimer?: NodeJS.Timeout;
};

type AskStreamEventBase = {
  readonly schema: AskStreamEventSchema;
  readonly type: AskStreamEventType;
  readonly streamId: string;
  readonly sequence: number;
  readonly timestamp: string;
};

type AskStreamStartEvent = AskStreamEventBase & AskStreamStartPayload;

type AskStreamChunkEvent = AskStreamEventBase & AskStreamChunkPayload;

type AskStreamHeartbeatEvent = AskStreamEventBase & AskStreamHeartbeatPayload;

type AskStreamDoneEvent = AskStreamEventBase & AskStreamDonePayload;

type AskStreamErrorEvent = AskStreamEventBase & AskStreamErrorPayload;

export type AskStreamEvent =
  AskStreamStartEvent | AskStreamChunkEvent | AskStreamHeartbeatEvent | AskStreamDoneEvent | AskStreamErrorEvent;
