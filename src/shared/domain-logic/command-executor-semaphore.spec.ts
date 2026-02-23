import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));
vi.mock('../utils/platform.util.ts', () => ({ killProcess: vi.fn().mockResolvedValue(true) }));

const { default: crossSpawn } = await import('cross-spawn');
const { executeCommand } = await import('./command-executor.ts');

type EventHandler = (...args: unknown[]) => void;
type HandlerMap = Record<string, EventHandler[]>;

type ControllableChild = Readonly<{
  child: Record<string, unknown>;
  emitClose: (exitCode: number | null, signal: string | null) => void;
}>;

const createEventEmitter = (): Readonly<{ handlers: HandlerMap; on: (event: string, fn: EventHandler) => void }> => {
  const handlers: HandlerMap = {};

  return {
    handlers,
    on: (event: string, fn: EventHandler): void => {
      handlers[event] ??= [];
      handlers[event].push(fn);
    },
  };
};

const emit = (handlers: HandlerMap, event: string, ...args: unknown[]): void => {
  handlers[event]?.forEach((handler) => {
    handler(...args);
  });
};

const createControllableChild = (): ControllableChild => {
  const main = createEventEmitter();
  const stdout = createEventEmitter();
  const stderr = createEventEmitter();

  return {
    child: {
      pid: 1234,
      stdout: { on: stdout.on },
      stderr: { on: stderr.on },
      stdin: { write: vi.fn(), end: vi.fn() },
      on: main.on,
    },
    emitClose: (exitCode, signal): void => {
      emit(main.handlers, 'close', exitCode, signal);
    },
  };
};

const baseOptions = {
  binaryPath: '/usr/bin/test-cli',
  args: ['run'],
  env: { PATH: '/usr/bin' },
  timeoutMs: 5_000,
  bypassSemaphore: false,
};

const drainMicrotasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('executeCommand semaphore concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN 5 in-flight commands WHEN a 6th is queued THEN it waits until a slot is released', async () => {
    const children = Array.from({ length: 6 }, () => createControllableChild());
    let callIndex = 0;

    vi.mocked(crossSpawn).mockImplementation(() => {
      const child = children[callIndex];
      const resolvedChild = child ?? children[0];

      callIndex += 1;

      expect(resolvedChild).toBeDefined();

      return resolvedChild?.child as unknown as ReturnType<typeof crossSpawn>;
    });

    const runCommand = async (): Promise<Awaited<ReturnType<typeof executeCommand>>> => executeCommand(baseOptions);
    const promises = Array.from({ length: 6 }, runCommand);

    await drainMicrotasks();
    expect(crossSpawn).toHaveBeenCalledTimes(5);

    children[0]?.emitClose(0, null);

    await drainMicrotasks();
    expect(crossSpawn).toHaveBeenCalledTimes(6);

    children.slice(1).forEach((child) => {
      child.emitClose(0, null);
    });

    await Promise.all(promises);
  });
});
