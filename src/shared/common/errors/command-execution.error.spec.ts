import { describe, expect, it } from 'vitest';

import { CommandExecutionError } from './command-execution.error.ts';
import { MAX_ERROR_STDERR_BYTES } from '../execution-limits.const.ts';

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
