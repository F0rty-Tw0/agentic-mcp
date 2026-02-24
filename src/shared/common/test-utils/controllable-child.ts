import { vi } from 'vitest';

export type EventHandler = (...args: unknown[]) => void;

export type HandlerMap = Record<string, EventHandler[]>;

type EventEmitter = Readonly<{ handlers: HandlerMap; on: (event: string, fn: EventHandler) => void }>;

const createEventEmitter = (): EventEmitter => {
  const handlers: HandlerMap = {};

  return {
    handlers,
    on: (event: string, fn: EventHandler): void => {
      handlers[event] ??= [];
      handlers[event].push(fn);
    },
  };
};

export const emit = (emitter: EventEmitter, event: string, ...args: unknown[]): void => {
  const fns = emitter.handlers[event];

  if (fns) {
    fns.forEach((fn) => {
      fn(...args);
    });
  }
};

type MockFn = ReturnType<typeof vi.fn>;

export type ControllableChild = Readonly<{
  child: Record<string, unknown>;
  stdin: Readonly<{ write: MockFn; end: MockFn }>;
  emitClose: (exitCode: number | null, signal: string | null) => void;
  emitError: (error: Error) => void;
  emitStdout: (data: Buffer) => void;
  emitStderr: (data: Buffer) => void;
}>;

export const createControllableChild = (pid: number | null = 1234): ControllableChild => {
  const main = createEventEmitter();
  const stdoutEmitter = createEventEmitter();
  const stderrEmitter = createEventEmitter();
  const stdinMock = { write: vi.fn(), end: vi.fn() };

  const child: Record<string, unknown> = {
    ...(pid != null ? { pid } : {}),
    stdout: { on: stdoutEmitter.on },
    stderr: { on: stderrEmitter.on },
    stdin: stdinMock,
    on: main.on,
  };

  return {
    child,
    stdin: stdinMock,
    emitClose: (exitCode, signal) => emit(main, 'close', exitCode, signal),
    emitError: (error) => emit(main, 'error', error),
    emitStdout: (data) => emit(stdoutEmitter, 'data', data),
    emitStderr: (data) => emit(stderrEmitter, 'data', data),
  };
};
