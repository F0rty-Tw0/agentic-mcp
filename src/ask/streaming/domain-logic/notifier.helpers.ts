import type { ProgressContext } from '../../../shared/common';
import { ASK_STREAM_EVENT_SCHEMA, MAX_STREAM_CHUNK_BYTES, TERMINAL_EVENT_GRACE_TIMEOUT_MS } from '../common';
import type { AskStreamChannel, AskStreamDiagnostics, AskStreamEvent, AskStreamExecutionSummary } from '../common';

export type ProgressToken = string | number;

export type StreamNotifier = Readonly<{
  onStdoutChunk: (chunk: string) => void;
  onStderrChunk: (chunk: string) => void;
  emitStart: () => void;
  emitDone: (summary: AskStreamExecutionSummary) => void;
  emitError: (error: string, summary?: AskStreamExecutionSummary) => void;
  stop: () => void;
  enabled: boolean;
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

type StreamEnabledInput = Readonly<{
  args: { stream_live?: boolean };
  progressToken: ProgressToken | null;
  extra?: ProgressContext;
}>;

const noop = (): void => undefined;

const toMeta = (extra?: ProgressContext): Readonly<{ progressToken?: ProgressToken }> | null => {
  if (!extra) return null;

  // eslint-disable-next-line no-underscore-dangle
  const meta = extra._meta;

  return meta ?? null;
};

export const resolveProgressToken = (extra?: ProgressContext): ProgressToken | null => {
  if (!extra?.sendNotification) return null;

  const token = toMeta(extra)?.progressToken;

  return token ?? null;
};

export const isStreamEnabled = ({ args, progressToken, extra }: StreamEnabledInput): boolean => {
  return args.stream_live === true && progressToken != null && extra?.sendNotification != null;
};

export const splitChunkByBytes = (chunk: string): string[] => {
  if (Buffer.byteLength(chunk, 'utf-8') <= MAX_STREAM_CHUNK_BYTES) return [chunk];

  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const character of chunk) {
    const characterBytes = Buffer.byteLength(character, 'utf-8');

    if (currentBytes + characterBytes > MAX_STREAM_CHUNK_BYTES && current.length > 0) {
      parts.push(current);
      current = character;
      currentBytes = characterBytes;
      continue;
    }

    current += character;
    currentBytes += characterBytes;
  }

  if (current.length > 0) parts.push(current);

  return parts;
};

export const buildStreamDiagnostics = (input: {
  streamId: string;
  sequence: number;
  emittedChunks: number;
  droppedChunks: number;
  coalescedChunks: number;
}): AskStreamDiagnostics => {
  return {
    streamId: input.streamId,
    lastSequence: input.sequence - 1,
    emittedChunks: input.emittedChunks,
    droppedChunks: input.droppedChunks,
    coalescedChunks: input.coalescedChunks,
    terminalEventGraceTimeoutMs: TERMINAL_EVENT_GRACE_TIMEOUT_MS,
  };
};

export const withEventEnvelope = (event: AskStreamEventPayload, streamId: string, sequence: number): AskStreamEvent => {
  return {
    schema: ASK_STREAM_EVENT_SCHEMA,
    sequence,
    streamId,
    timestamp: new Date().toISOString(),
    ...event,
  };
};

export const createNoopStreamNotifier = (): StreamNotifier => ({
  onStdoutChunk: noop,
  onStderrChunk: noop,
  emitStart: noop,
  emitDone: noop,
  emitError: noop,
  stop: noop,
  enabled: false,
});

export const buildExecutionSummary = (result: {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  truncated: boolean;
  stdoutBytes: number;
  stderrBytes: number;
  executionTimeMs: number;
}): AskStreamExecutionSummary => ({
  exitCode: result.exitCode,
  signal: result.signal,
  timedOut: result.timedOut,
  truncated: result.truncated,
  stdoutBytes: result.stdoutBytes,
  stderrBytes: result.stderrBytes,
  executionTimeMs: result.executionTimeMs,
});
