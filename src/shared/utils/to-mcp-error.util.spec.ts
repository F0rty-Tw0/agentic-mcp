import { describe, expect, it } from 'vitest';

import { toMcpError } from './index.ts';
import { CommandExecutionError, ValidationError } from '../common/errors/index.ts';

describe('toMcpError', () => {
  it('GIVEN a ValidationError WHEN converted THEN delegates to toMcpResponse', () => {
    const error = new ValidationError('field is required');

    const result = toMcpError(error);

    expect(result).toStrictEqual({
      isError: true,
      content: [{ type: 'text', text: 'Validation error: field is required' }],
    });
  });

  it('GIVEN a CommandExecutionError WHEN converted THEN delegates to toMcpResponse', () => {
    const error = new CommandExecutionError('command failed', { exitCode: 1 });

    const result = toMcpError(error);

    expect(result).toStrictEqual({
      isError: true,
      content: [{ type: 'text', text: 'command failed Exit code: 1.' }],
    });
  });

  it('GIVEN a CommandExecutionError with stderr WHEN converted THEN includes stderr in response', () => {
    const error = new CommandExecutionError('spawn failed', {
      exitCode: 2,
      stderr: 'permission denied',
    });

    const result = toMcpError(error);

    expect(result.content[0]?.text).toContain('Stderr: permission denied');
  });

  it('GIVEN a CommandExecutionError that timed out WHEN converted THEN includes timeout message', () => {
    const error = new CommandExecutionError('slow command', { timedOut: true });

    const result = toMcpError(error);

    expect(result.content[0]?.text).toContain('Process timed out.');
  });

  it('GIVEN a plain Error WHEN converted THEN wraps message with Error prefix', () => {
    const error = new Error('something broke');

    const result = toMcpError(error);

    expect(result).toStrictEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error: something broke' }],
    });
  });

  it('GIVEN a string WHEN converted THEN wraps string with Error prefix', () => {
    const result = toMcpError('raw string error');

    expect(result).toStrictEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error: raw string error' }],
    });
  });

  it('GIVEN an unknown value WHEN converted THEN returns generic error message', () => {
    const result = toMcpError(42);

    expect(result).toStrictEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error: An unexpected error occurred.' }],
    });
  });

  it('GIVEN null WHEN converted THEN returns generic error message', () => {
    const result = toMcpError(null);

    expect(result).toStrictEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error: An unexpected error occurred.' }],
    });
  });

  it('GIVEN undefined WHEN converted THEN returns generic error message', () => {
    const result = toMcpError(undefined);

    expect(result).toStrictEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error: An unexpected error occurred.' }],
    });
  });

  it('GIVEN any error WHEN converted THEN isError is always true', () => {
    expect(toMcpError(new Error('x')).isError).toBe(true);
    expect(toMcpError('x').isError).toBe(true);
    expect(toMcpError(null).isError).toBe(true);
    expect(toMcpError(new ValidationError('x')).isError).toBe(true);
  });

  it('GIVEN any error WHEN converted THEN content has exactly one text entry', () => {
    expect(toMcpError(new Error('x')).content).toHaveLength(1);
    expect(toMcpError('x').content).toHaveLength(1);
    expect(toMcpError(null).content).toHaveLength(1);
    expect(toMcpError(new ValidationError('x')).content).toHaveLength(1);
    expect(toMcpError(new CommandExecutionError('x', {})).content).toHaveLength(1);
  });
});
