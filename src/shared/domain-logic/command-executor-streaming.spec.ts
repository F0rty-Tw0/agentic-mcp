import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));

const { default: crossSpawn } = await import('cross-spawn');
const { executeCommand } = await import('./command-executor.ts');

type EventHandler = (...args: unknown[]) => void;
type HandlerMap = Record<string, EventHandler[]>;

type ControllableChild = Readonly<{
  child: Record<string, unknown>;
  emitClose: (exitCode: number | null, signal: string | null) => void;
  emitStdout: (chunk: Buffer) => void;
}>;

const createControllableChild = (): ControllableChild => {
  const handlers: HandlerMap = {};
  const stdoutHandlers: HandlerMap = {};

  const on = (store: HandlerMap) => {
    return (event: string, callback: EventHandler): void => {
      store[event] ??= [];
      store[event].push(callback);
    };
  };

  const emit = (store: HandlerMap, event: string, ...args: unknown[]): void => {
    const registered = store[event];

    if (!registered) return;

    registered.forEach((handler) => {
      handler(...args);
    });
  };

  return {
    child: {
      pid: 1,
      stdout: { on: on(stdoutHandlers) },
      stderr: { on: on({}) },
      stdin: { write: vi.fn(), end: vi.fn() },
      on: on(handlers),
    },
    emitClose: (exitCode, signal): void => {
      emit(handlers, 'close', exitCode, signal);
    },
    emitStdout: (chunk): void => {
      emit(stdoutHandlers, 'data', chunk);
    },
  };
};

const baseOptions = {
  binaryPath: '/usr/bin/test-cli',
  args: ['run'],
  env: { PATH: '/usr/bin' },
  timeoutMs: 5_000,
  bypassSemaphore: true,
};

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
