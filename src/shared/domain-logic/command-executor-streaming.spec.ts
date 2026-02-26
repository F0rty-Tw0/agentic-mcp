import crossSpawn from 'cross-spawn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommand } from './command-executor';
import { TEST_EXECUTE_COMMAND_OPTIONS_STUB } from '../common/stubs';
import { createControllableChild } from '../common/test-utils';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));

const baseOptions = { ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true };

describe('executeCommand streaming callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN onStdoutChunk callback WHEN child emits stdout data THEN callback receives chunk in order', async () => {
    const controllable = createControllableChild();
    const chunks: string[] = [];

    vi.mocked(crossSpawn).mockReturnValue(controllable.child as unknown as ReturnType<typeof crossSpawn>);

    const resultPromise = executeCommand({
      ...baseOptions,
      onStdoutChunk: (chunk: string): void => {
        chunks.push(chunk);
      },
    });

    controllable.emitStdout(Buffer.from('first'));
    controllable.emitStdout(Buffer.from('second'));
    controllable.emitClose(0, null);
    await resultPromise;

    expect(chunks).toStrictEqual(['first', 'second']);
  });

  it('GIVEN onStderrChunk callback WHEN child emits stderr data THEN callback receives chunks in order', async () => {
    const controllable = createControllableChild();
    const chunks: string[] = [];

    vi.mocked(crossSpawn).mockReturnValue(controllable.child as unknown as ReturnType<typeof crossSpawn>);

    const resultPromise = executeCommand({
      ...baseOptions,
      onStderrChunk: (chunk: string): void => {
        chunks.push(chunk);
      },
    });

    controllable.emitStderr(Buffer.from('err1'));
    controllable.emitStderr(Buffer.from('err2'));
    controllable.emitClose(0, null);
    await resultPromise;

    expect(chunks).toStrictEqual(['err1', 'err2']);
  });

  it('GIVEN chunk callback throws WHEN processing stream THEN execution still completes', async () => {
    const controllable = createControllableChild();

    vi.mocked(crossSpawn).mockReturnValue(controllable.child as unknown as ReturnType<typeof crossSpawn>);

    const resultPromise = executeCommand({
      ...baseOptions,
      onStdoutChunk: (): void => {
        throw new Error('boom');
      },
    });

    controllable.emitStdout(Buffer.from('safe-output'));
    controllable.emitClose(0, null);
    const result = await resultPromise;

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('safe-output');
  });
});
