import process from 'node:process';

import type { Progress } from '@modelcontextprotocol/sdk/types.js';

import { ASK_STREAM_EVENT_SCHEMA } from '../../streaming/common';
import type { AskStreamEvent } from '../../streaming/common';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  const result = typeof value === 'object' && value !== null;

  return result;
};

const hasBaseEventFields = (value: Readonly<Record<string, unknown>>): boolean => {
  const result =
    value.schema === ASK_STREAM_EVENT_SCHEMA &&
    typeof value.type === 'string' &&
    typeof value.streamId === 'string' &&
    typeof value.sequence === 'number' &&
    typeof value.timestamp === 'string';

  return result;
};

const isSystemEvent = (value: Readonly<Record<string, unknown>>): boolean => {
  const result = value.channel === 'system';

  return result;
};

const isChunkEvent = (value: Readonly<Record<string, unknown>>): boolean => {
  const result = typeof value.chunk === 'string' && typeof value.channel === 'string';

  return result;
};

const isDoneEvent = (value: Readonly<Record<string, unknown>>): boolean => {
  const result = value.channel === 'system' && isRecord(value.summary) && isRecord(value.diagnostics);

  return result;
};

const isErrorEvent = (value: Readonly<Record<string, unknown>>): boolean => {
  const result = value.channel === 'system' && typeof value.error === 'string' && isRecord(value.diagnostics);

  return result;
};

const STREAM_EVENT_VALIDATORS = {
  chunk: isChunkEvent,
  done: isDoneEvent,
  error: isErrorEvent,
  heartbeat: isSystemEvent,
  start: isSystemEvent,
} as const;

const isAskStreamEventType = (value: string): value is AskStreamEvent['type'] => {
  const result = value in STREAM_EVENT_VALIDATORS;

  return result;
};

const isAskStreamEvent = (value: unknown): value is AskStreamEvent => {
  if (!isRecord(value) || !hasBaseEventFields(value) || typeof value.type !== 'string') return false;

  if (!isAskStreamEventType(value.type)) return false;

  const validator = STREAM_EVENT_VALIDATORS[value.type];
  const result = validator(value);

  return result;
};

const parseAskStreamEvent = (message: string): AskStreamEvent | undefined => {
  try {
    const parsed: unknown = JSON.parse(message);

    if (!isAskStreamEvent(parsed)) return undefined;

    const result = parsed;

    return result;
  } catch {
    return undefined;
  }
};

const ensureTrailingNewline = (text: string): string => {
  if (text.endsWith('\n')) return text;

  const result = `${text}\n`;

  return result;
};

const writePlainProgress = (message: string): void => {
  process.stderr.write(ensureTrailingNewline(message));
};

const renderStreamEvent = (event: AskStreamEvent): void => {
  if (event.type === 'chunk') {
    if (event.channel === 'stdout') {
      process.stdout.write(event.chunk);

      return;
    }

    process.stderr.write(event.chunk);

    return;
  }

  if (event.type === 'error') {
    writePlainProgress(event.error);
  }
};

export const renderCliProgress = (progress: Progress): void => {
  if (typeof progress.message !== 'string' || progress.message.length === 0) return;

  const streamEvent = parseAskStreamEvent(progress.message);

  if (!streamEvent) {
    writePlainProgress(progress.message);

    return;
  }

  renderStreamEvent(streamEvent);
};
