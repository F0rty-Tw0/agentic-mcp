import type { CallToolResult } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAskInvocation } from './ask-runner';
import type { ExecutionResult } from '../../shared/command-execution/common';
import type * as streamingModule from '../../streaming';
import type { StreamNotifier } from '../../streaming/common';
import type { AskExecution, AskToolArgs } from '../common';
import { ASK_RESOLVED_PROVIDER_ENTRY_STUB } from '../test/stubs/ask-resolved-provider-entry.stub';

type FailedRunInput = {
  readonly streamNotifier: StreamNotifier;
};

const ASK_ARGS: AskToolArgs = { prompt: 'hi' };

const { liveNotifier, failedResult, failedExecution } = vi.hoisted(() => {
  const notifier: StreamNotifier = {
    onStdoutChunk: vi.fn(),
    onStderrChunk: vi.fn(),
    emitStart: vi.fn(),
    emitDone: vi.fn(),
    emitError: vi.fn(),
    flush: vi.fn(),
    stop: vi.fn(),
    enabled: true,
  };
  const result: ExecutionResult = {
    stdout: '',
    stderr: 'boom',
    exitCode: 2,
    signal: null,
    timedOut: false,
    truncated: false,
    stdoutBytes: 0,
    stderrBytes: 4,
    executionTimeMs: 100,
  };
  const response: CallToolResult = { content: [], isError: true };
  const execution: AskExecution = { response, responseText: '', sessionMode: 'none', wasCancelled: false };
  const hoisted = { liveNotifier: notifier, failedResult: result, failedExecution: execution };

  return hoisted;
});

vi.mock('./ask-command-execution', () => {
  const outcome = { result: failedResult, outputFormat: 'text' };
  const result = { runCommandExecution: vi.fn(async () => Promise.resolve(outcome)) };

  return result;
});

vi.mock('./ask-command', () => {
  const env = {};
  const result = {
    buildExecutionEnv: vi.fn(() => env),
    resolveModelFallback: vi.fn(async () => Promise.resolve(undefined)),
  };

  return result;
});

vi.mock('./ask-runner-failure', () => {
  const buildFailedRunExecution = vi.fn(async (failedRunInput: FailedRunInput) => {
    failedRunInput.streamNotifier.emitError('boom');

    return Promise.resolve(failedExecution);
  });
  const result = { buildFailedRunExecution, buildThrownRunExecution: vi.fn() };

  return result;
});

vi.mock('../../streaming', async (importOriginal) => {
  const actual = await importOriginal<typeof streamingModule>();
  const result = { ...actual, createStreamNotifier: vi.fn(() => liveNotifier) };

  return result;
});

const runFailedInvocation = async (willRetry?: (execution: AskExecution) => boolean): Promise<AskExecution> => {
  const invocationInput = { context: ASK_RESOLVED_PROVIDER_ENTRY_STUB, args: ASK_ARGS, willRetry };
  const execution = await runAskInvocation(invocationInput);

  return execution;
};

describe('FEATURE: runAskInvocation', () => {
  beforeEach(() => {
    vi.mocked(liveNotifier.emitError).mockClear();
  });

  describe('GIVEN a failed run', () => {
    it('WHEN the caller will retry it THEN the live stream gets no error', async () => {
      await runFailedInvocation(() => true);

      expect(liveNotifier.emitError).not.toHaveBeenCalled();
    });

    it('WHEN the caller will not retry it THEN the live stream gets the error once', async () => {
      await runFailedInvocation(() => false);

      expect(liveNotifier.emitError).toHaveBeenCalledExactlyOnceWith('boom', undefined);
    });

    it('WHEN the caller gives no retry check THEN the live stream gets the error once', async () => {
      await runFailedInvocation();

      expect(liveNotifier.emitError).toHaveBeenCalledExactlyOnceWith('boom', undefined);
    });
  });
});
