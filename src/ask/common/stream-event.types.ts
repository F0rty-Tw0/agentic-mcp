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
