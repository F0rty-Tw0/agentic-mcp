import type { ProgressContext, ProgressToken } from '../../shared/mcp-protocol/common';
import { ASK_STREAM_EVENT_SCHEMA, MAX_STREAM_CHUNK_BYTES, TERMINAL_EVENT_GRACE_TIMEOUT_MS } from '../common';
import type {
  AskStreamDiagnostics,
  AskStreamEvent,
  AskStreamEventPayload,
  AskStreamExecutionSummary,
  StreamNotifier,
} from '../common';

type StreamLiveArgs = { readonly stream_live?: boolean };

type ProgressMeta = { readonly progressToken?: ProgressToken };

type StreamEnabledInput = {
  readonly args: StreamLiveArgs;
  readonly progressToken?: ProgressToken;
  readonly extra?: ProgressContext;
};

type BuildStreamDiagnosticsInput = {
  readonly streamId: string;
  readonly sequence: number;
  readonly emittedChunks: number;
  readonly droppedChunks: number;
  readonly coalescedChunks: number;
};

type BuildExecutionSummaryInput = {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  readonly truncated: boolean;
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
  readonly executionTimeMs: number;
};

const noop = (): void => undefined;

const toMeta = (extra?: ProgressContext): ProgressMeta | undefined => {
  if (!extra) return;

  // eslint-disable-next-line no-underscore-dangle
  const meta = extra._meta;

  return meta;
};

export const resolveProgressToken = (extra?: ProgressContext): ProgressToken | undefined => {
  if (!extra?.sendNotification) return;

  const token = toMeta(extra)?.progressToken;

  return token;
};

export const isStreamEnabled = ({ args, progressToken, extra }: StreamEnabledInput): boolean => {
  return args.stream_live === true && progressToken !== undefined && extra?.sendNotification !== undefined;
};

export const splitChunkByBytes = (chunk: string): string[] => {
  const chunkBytes = Buffer.byteLength(chunk, 'utf-8');

  if (chunkBytes <= MAX_STREAM_CHUNK_BYTES) return [chunk];

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

export const buildStreamDiagnostics = (input: BuildStreamDiagnosticsInput): AskStreamDiagnostics => {
  const askStreamDiagnostics: AskStreamDiagnostics = {
    streamId: input.streamId,
    lastSequence: input.sequence - 1,
    emittedChunks: input.emittedChunks,
    droppedChunks: input.droppedChunks,
    coalescedChunks: input.coalescedChunks,
    terminalEventGraceTimeoutMs: TERMINAL_EVENT_GRACE_TIMEOUT_MS,
  };

  return askStreamDiagnostics;
};

export const withEventEnvelope = (event: AskStreamEventPayload, streamId: string, sequence: number): AskStreamEvent => {
  const askStreamEvent: AskStreamEvent = {
    schema: ASK_STREAM_EVENT_SCHEMA,
    sequence,
    streamId,
    timestamp: new Date().toISOString(),
    ...event,
  };

  return askStreamEvent;
};

export const createNoopStreamNotifier = (): StreamNotifier => {
  const streamNotifier: StreamNotifier = {
    onStdoutChunk: noop,
    onStderrChunk: noop,
    emitStart: noop,
    emitDone: noop,
    emitError: noop,
    stop: noop,
    enabled: false,
  };

  return streamNotifier;
};

export const buildExecutionSummary = (result: BuildExecutionSummaryInput): AskStreamExecutionSummary => {
  const askStreamExecutionSummary: AskStreamExecutionSummary = {
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    truncated: result.truncated,
    stdoutBytes: result.stdoutBytes,
    stderrBytes: result.stderrBytes,
    executionTimeMs: result.executionTimeMs,
  };

  return askStreamExecutionSummary;
};
