export const ASK_STREAM_EVENT_SCHEMA = 'agentic-mcp.ask.stream.v1';

export type AskStreamEventType = 'start' | 'chunk' | 'heartbeat' | 'done' | 'error';

export type AskStreamChannel = 'stdout' | 'stderr' | 'system';

export type AskStreamExecutionSummary = Readonly<{
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  truncated: boolean;
  stdoutBytes: number;
  stderrBytes: number;
  executionTimeMs: number;
}>;

export type AskStreamDiagnostics = Readonly<{
  streamId: string;
  lastSequence: number;
  emittedChunks: number;
  droppedChunks: number;
  coalescedChunks: number;
  terminalEventGraceTimeoutMs: number;
}>;

export type AskStreamEventPayload =
  | Readonly<{ type: 'start'; channel: 'system' }>
  | Readonly<{ type: 'heartbeat'; channel: 'system' }>
  | Readonly<{ type: 'chunk'; channel: AskStreamChannel; chunk: string }>
  | Readonly<{
      type: 'done';
      channel: 'system';
      summary: AskStreamExecutionSummary;
      diagnostics: AskStreamDiagnostics;
    }>
  | Readonly<{
      type: 'error';
      channel: 'system';
      error: string;
      summary?: AskStreamExecutionSummary;
      diagnostics: AskStreamDiagnostics;
    }>;

export type StreamNotifier = Readonly<{
  onStdoutChunk: (chunk: string) => void;
  onStderrChunk: (chunk: string) => void;
  emitStart: () => void;
  emitDone: (summary: AskStreamExecutionSummary) => void;
  emitError: (error: string, summary?: AskStreamExecutionSummary) => void;
  stop: () => void;
  enabled: boolean;
}>;

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

type AskStreamEventBase = Readonly<{
  schema: typeof ASK_STREAM_EVENT_SCHEMA;
  type: AskStreamEventType;
  streamId: string;
  sequence: number;
  timestamp: string;
}>;

type AskStreamStartEvent = AskStreamEventBase &
  Readonly<{
    type: 'start';
    channel: 'system';
  }>;

type AskStreamChunkEvent = AskStreamEventBase &
  Readonly<{
    type: 'chunk';
    channel: AskStreamChannel;
    chunk: string;
  }>;

type AskStreamHeartbeatEvent = AskStreamEventBase &
  Readonly<{
    type: 'heartbeat';
    channel: 'system';
  }>;

type AskStreamDoneEvent = AskStreamEventBase &
  Readonly<{
    type: 'done';
    channel: 'system';
    summary: AskStreamExecutionSummary;
    diagnostics: AskStreamDiagnostics;
  }>;

type AskStreamErrorEvent = AskStreamEventBase &
  Readonly<{
    type: 'error';
    channel: 'system';
    error: string;
    summary?: AskStreamExecutionSummary;
    diagnostics: AskStreamDiagnostics;
  }>;

export type AskStreamEvent =
  | AskStreamStartEvent
  | AskStreamChunkEvent
  | AskStreamHeartbeatEvent
  | AskStreamDoneEvent
  | AskStreamErrorEvent;
