import type { Progress } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { renderCliProgress } from './cli-progress-renderer.util';
import { ASK_STREAM_EVENT_SCHEMA } from '../../streaming/common';
import type { AskStreamDiagnostics, AskStreamEvent, AskStreamExecutionSummary } from '../../streaming/common';

const buildSummary = (): AskStreamExecutionSummary => ({
  exitCode: 0,
  signal: null,
  timedOut: false,
  truncated: false,
  stdoutBytes: 1,
  stderrBytes: 0,
  executionTimeMs: 1,
});

const buildDiagnostics = (): AskStreamDiagnostics => ({
  streamId: 'stream-1',
  lastSequence: 1,
  emittedChunks: 1,
  droppedChunks: 0,
  coalescedChunks: 0,
  terminalEventGraceTimeoutMs: 1000,
});

const buildProgress = (message: string): Progress => ({
  progress: 1,
  message,
});

const buildEvent = (overrides: Partial<AskStreamEvent>): AskStreamEvent =>
  ({
    schema: ASK_STREAM_EVENT_SCHEMA,
    type: 'chunk',
    streamId: 'stream-1',
    sequence: 1,
    timestamp: '2026-03-08T00:00:00.000Z',
    channel: 'stdout',
    chunk: 'hello',
    ...overrides,
  }) as AskStreamEvent;

describe('renderCliProgress', () => {
  let stdoutSpy: MockInstance;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN a chunk event on stdout WHEN rendering progress THEN it writes the chunk without adding a newline', () => {
    const event = buildEvent({ chunk: 'live', channel: 'stdout' });

    renderCliProgress(buildProgress(JSON.stringify(event)));

    expect(stdoutSpy).toHaveBeenCalledWith('live');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('GIVEN a chunk event on stderr WHEN rendering progress THEN it writes the chunk to stderr', () => {
    const event = buildEvent({ chunk: 'warn', channel: 'stderr' });

    renderCliProgress(buildProgress(JSON.stringify(event)));

    expect(stderrSpy).toHaveBeenCalledWith('warn');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('GIVEN start and heartbeat events WHEN rendering progress THEN it ignores them for normal CLI output', () => {
    const startEvent = buildEvent({ type: 'start', channel: 'system' });
    const heartbeatEvent = buildEvent({ type: 'heartbeat', channel: 'system' });

    renderCliProgress(buildProgress(JSON.stringify(startEvent)));
    renderCliProgress(buildProgress(JSON.stringify(heartbeatEvent)));

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('GIVEN an error event WHEN rendering progress THEN it writes the error to stderr', () => {
    const event = buildEvent({
      type: 'error',
      channel: 'system',
      error: 'stream failed',
      diagnostics: buildDiagnostics(),
      summary: buildSummary(),
    });

    renderCliProgress(buildProgress(JSON.stringify(event)));

    expect(stderrSpy).toHaveBeenCalledWith('stream failed\n');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('GIVEN a plain-text progress message WHEN rendering progress THEN it writes a conservative stderr line', () => {
    renderCliProgress(buildProgress('plain progress'));

    expect(stderrSpy).toHaveBeenCalledWith('plain progress\n');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('GIVEN a done event WHEN rendering progress THEN it ignores the event because final output comes from CallToolResult', () => {
    const event = buildEvent({
      type: 'done',
      channel: 'system',
      diagnostics: buildDiagnostics(),
      summary: buildSummary(),
    });

    renderCliProgress(buildProgress(JSON.stringify(event)));

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
