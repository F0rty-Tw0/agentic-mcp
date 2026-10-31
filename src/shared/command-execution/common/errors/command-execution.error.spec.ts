import { describe, expect, it } from 'vitest';

import { CommandExecutionError, QueueTimeoutError } from './command-execution.error';
import type { ExecutionTimeoutCause } from '../command-executor.type';
import { MAX_ERROR_STDERR_BYTES } from '../execution-limits.const';

describe('CommandExecutionError.toMcpResponse', () => {
  it('GIVEN error with message only WHEN toMcpResponse called THEN returns isError response with message', () => {
    const error = new CommandExecutionError('command failed', {});

    const result = error.toMcpResponse();

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('command failed');
  });

  it('GIVEN error with exitCode WHEN toMcpResponse called THEN includes exit code in response', () => {
    const error = new CommandExecutionError('command failed', { exitCode: 1 });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).toContain('Exit code: 1.');
  });

  it('GIVEN error with signal WHEN toMcpResponse called THEN includes signal in response', () => {
    const error = new CommandExecutionError('command killed', { signal: 'SIGKILL' });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).toContain('Killed by signal: SIGKILL.');
  });

  it('GIVEN error with timedOut WHEN toMcpResponse called THEN includes timeout message in response', () => {
    const error = new CommandExecutionError('slow command', { timedOut: true });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).toContain('Process timed out.');
  });

  it('GIVEN a wall-clock timeout cause WHEN toMcpResponse called THEN it says the run timed out after the limit in seconds', () => {
    const timeoutCause: ExecutionTimeoutCause = { kind: 'wall-clock', limitMs: 3_600_000 };
    const error = new CommandExecutionError('slow command', { timedOut: true, timeoutCause });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).toBe('slow command Process timed out after 3600 s (provider timeout).');
  });

  it('GIVEN an idle timeout cause WHEN toMcpResponse called THEN it says the process gave no output for the idle limit in seconds', () => {
    const timeoutCause: ExecutionTimeoutCause = { kind: 'idle', limitMs: 600_000 };
    const error = new CommandExecutionError('silent command', { timedOut: true, timeoutCause });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).toBe(
      'silent command Process killed after no output for 600 s (provider idleTimeout).'
    );
  });

  it('GIVEN error with short stderr WHEN toMcpResponse called THEN includes full stderr without truncation', () => {
    const error = new CommandExecutionError('command failed', { exitCode: 1, stderr: 'short error message' });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).toContain('Stderr: short error message');
    expect(result.content[0]?.text).not.toContain('[stderr truncated]');
  });

  it('GIVEN error with stderr exceeding MAX_ERROR_STDERR_BYTES WHEN toMcpResponse called THEN truncates stderr and appends marker', () => {
    const longStderr = 'x'.repeat(MAX_ERROR_STDERR_BYTES + 100);
    const error = new CommandExecutionError('command failed', { exitCode: 1, stderr: longStderr });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).toContain('[stderr truncated]');
    expect(result.content[0]?.text).not.toContain('x'.repeat(MAX_ERROR_STDERR_BYTES + 1));
  });

  it('GIVEN error with stderr exactly at MAX_ERROR_STDERR_BYTES WHEN toMcpResponse called THEN does not truncate', () => {
    const exactStderr = 'y'.repeat(MAX_ERROR_STDERR_BYTES);
    const error = new CommandExecutionError('command failed', { exitCode: 1, stderr: exactStderr });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).not.toContain('[stderr truncated]');
    expect(result.content[0]?.text).toContain(`Stderr: ${exactStderr}`);
  });

  it('GIVEN error with parsed stdout output WHEN toMcpResponse called THEN includes output section', () => {
    const error = new CommandExecutionError('command failed', {
      exitCode: 1,
      output: 'Please run claude login to authenticate.',
    });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).toContain('Output: Please run claude login to authenticate.');
  });

  it('GIVEN error with no stderr WHEN toMcpResponse called THEN does not include Stderr section', () => {
    const error = new CommandExecutionError('command failed', { exitCode: 1 });

    const result = error.toMcpResponse();

    expect(result.content[0]?.text).not.toContain('Stderr:');
  });

  it('GIVEN any error WHEN toMcpResponse called THEN content has exactly one text entry', () => {
    const error = new CommandExecutionError('command failed', { exitCode: 1, stderr: 'some error' });

    const result = error.toMcpResponse();

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');
  });
});

const getFirstText = (error: CommandExecutionError): string => {
  const result = error.toMcpResponse();
  const firstContent = result.content[0];

  if (!firstContent) throw new Error('Expected a single text response');

  return firstContent.text;
};

describe('QueueTimeoutError', () => {
  it('GIVEN provider queue timeout details WHEN constructing THEN it stores provider and wait metadata', () => {
    const error = new QueueTimeoutError({ providerName: 'codex', waitMs: 31, queueTimeoutMs: 30 });

    expect(error.providerName).toBe('codex');
    expect(error.waitMs).toBe(31);
    expect(error.queueTimeoutMs).toBe(30);
  });

  it('GIVEN a QueueTimeoutError WHEN converting to MCP response THEN it reports provider wait and limit', () => {
    const error = new QueueTimeoutError({ providerName: 'codex', waitMs: 31, queueTimeoutMs: 30 });
    const text = getFirstText(error);

    expect(text).toContain('Queue timeout for provider "codex"');
    expect(text).toContain('waited 31 ms');
    expect(text).toContain('limit: 30 ms');
  });

  it('GIVEN a QueueTimeoutError after minutes of waiting WHEN converting to MCP response THEN it says the provider is busy, how long it waited and advice that fits any tool', () => {
    const error = new QueueTimeoutError({ providerName: 'codex', waitMs: 600_004, queueTimeoutMs: 600_000 });
    const text = getFirstText(error);

    expect(text).toBe(
      'Queue timeout for provider "codex": the provider is busy with other calls; waited 600 s for a free slot (limit: 600 s). Retry after those calls finish.'
    );
  });
});
