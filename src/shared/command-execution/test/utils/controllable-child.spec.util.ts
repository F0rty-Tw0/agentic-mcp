import { vi } from 'vitest';

import type { ControllableChild, ControllableChildStdin } from '../common/controllable-child.type';

type EventHandler = (...args: unknown[]) => void;

type HandlerMap = Record<string, EventHandler[]>;

type ChildProcessLike = Record<string, unknown>;

type EventEmitter = { readonly handlers: HandlerMap; readonly on: (event: string, fn: EventHandler) => void };

const createEventEmitter = (): EventEmitter => {
  const handlers: HandlerMap = {};

  const eventEmitter: EventEmitter = {
    handlers,
    on: (event: string, fn: EventHandler): void => {
      handlers[event] ??= [];
      handlers[event].push(fn);
    },
  };

  return eventEmitter;
};

const emit = (emitter: EventEmitter, event: string, ...args: unknown[]): void => {
  const fns = emitter.handlers[event];

  if (fns) {
    fns.forEach((fn) => {
      fn(...args);
    });
  }
};

export const createControllableChild = (pid?: number): ControllableChild => {
  const main = createEventEmitter();
  const stdoutEmitter = createEventEmitter();
  const stderrEmitter = createEventEmitter();
  const stdinMock: ControllableChildStdin = { write: vi.fn(), end: vi.fn() };

  const stdout = { on: stdoutEmitter.on };
  const stderr = { on: stderrEmitter.on };
  const child: ChildProcessLike = {
    pid,
    stdout,
    stderr,
    stdin: stdinMock,
    on: main.on,
  };

  const controllableChild: ControllableChild = {
    child,
    stdin: stdinMock,
    emitClose: (exitCode, signal) => emit(main, 'close', exitCode, signal),
    emitError: (error) => emit(main, 'error', error),
    emitStdout: (data) => emit(stdoutEmitter, 'data', data),
    emitStderr: (data) => emit(stderrEmitter, 'data', data),
  };

  return controllableChild;
};
