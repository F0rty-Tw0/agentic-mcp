import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandExecutionError } from '../common/index.ts';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));

vi.mock('../utils/platform.util.ts', () => ({
  killProcess: vi.fn().mockResolvedValue(true),
}));

const { default: crossSpawn } = await import('cross-spawn');
const { killProcess } = await import('../utils/platform.util.ts');
const { executeCommand } = await import('./command-executor.ts');

type EventHandler = (...args: unknown[]) => void;
type HandlerMap = Record<string, EventHandler[]>;
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

const emit = (emitter: EventEmitter, event: string, ...args: unknown[]): void => {
  const fns = emitter.handlers[event];

  if (fns) {
    fns.forEach((fn) => {
      fn(...args);
    });
  }
};

type MockFn = ReturnType<typeof vi.fn>;

type ControllableChild = Readonly<{
  child: Record<string, unknown>;
  stdin: Readonly<{ write: MockFn; end: MockFn }>;
  emitClose: (exitCode: number | null, signal: string | null) => void;
  emitError: (error: Error) => void;
  emitStdout: (data: Buffer) => void;
  emitStderr: (data: Buffer) => void;
}>;

const createControllableChild = (pid: number | null = 1234): ControllableChild => {
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

type AutoClosingOptions = Readonly<{
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  signal?: string | null;
}>;

const scheduleAutoClose = (emitter: ControllableChild, opts: Required<AutoClosingOptions>): void => {
  const emitOutputs = (): void => {
    if (opts.stdout) emitter.emitStdout(Buffer.from(opts.stdout));

    if (opts.stderr) emitter.emitStderr(Buffer.from(opts.stderr));
  };

  setTimeout(() => {
    emitOutputs();
    emitter.emitClose(opts.exitCode, opts.signal);
  }, 0);
};

const defaultAutoClosingOptions: Required<AutoClosingOptions> = {
  stdout: '',
  stderr: '',
  exitCode: 0,
  signal: null,
};

const resolveAutoClosingOptions = (options: AutoClosingOptions): Required<AutoClosingOptions> => ({
  ...defaultAutoClosingOptions,
  ...options,
});

const makeAutoClosingChild = (options: AutoClosingOptions = {}): Record<string, unknown> => {
  const emitter = createControllableChild();

  scheduleAutoClose(emitter, resolveAutoClosingOptions(options));

  return emitter.child;
};

const baseOptions = {
  binaryPath: '/usr/bin/test-cli',
  args: ['run'],
  env: { PATH: '/usr/bin' },
  timeoutMs: 5_000,
};

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

describe('executeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('basic execution', () => {
    it('GIVEN a command producing output WHEN executed THEN stdout and stderr are captured with byte counts', async () => {
      const child = makeAutoClosingChild({ stdout: 'hello', stderr: 'warn' });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...baseOptions, bypassSemaphore: true });

      expect(result.stdout).toBe('hello');
      expect(result.stderr).toBe('warn');
      expect(result.stdoutBytes).toBe(5);
      expect(result.stderrBytes).toBe(4);
      expect(result.truncated).toBe(false);
    });

    it('GIVEN command options WHEN executed THEN crossSpawn receives binaryPath, args, env, cwd, and stdio config', async () => {
      const child = makeAutoClosingChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      await executeCommand({ ...baseOptions, cwd: '/workspace', bypassSemaphore: true });

      expect(crossSpawn).toHaveBeenCalledWith('/usr/bin/test-cli', ['run'], {
        env: { PATH: '/usr/bin' },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: '/workspace',
      });
    });

    it('GIVEN a completed command WHEN result is returned THEN executionTimeMs is a non-negative number', async () => {
      const child = makeAutoClosingChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...baseOptions, bypassSemaphore: true });

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('exit codes and signals', () => {
    it('GIVEN a process exiting with non-zero code WHEN executed THEN exitCode is returned', async () => {
      const child = makeAutoClosingChild({ exitCode: 42 });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...baseOptions, bypassSemaphore: true });

      expect(result.exitCode).toBe(42);
      expect(result.signal).toBeNull();
      expect(result.timedOut).toBe(false);
    });

    it('GIVEN a process killed by signal WHEN executed THEN signal is returned with null exitCode', async () => {
      const child = makeAutoClosingChild({ exitCode: null, signal: 'SIGTERM' });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...baseOptions, bypassSemaphore: true });

      expect(result.exitCode).toBeNull();
      expect(result.signal).toBe('SIGTERM');
    });
  });

  describe('stdin', () => {
    it('GIVEN stdin option WHEN executed THEN stdin data is written and stream is closed', async () => {
      const { child, stdin, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...baseOptions, stdin: 'input data', bypassSemaphore: true });

      emitClose(0, null);
      await resultPromise;

      expect(stdin.write).toHaveBeenCalledWith('input data');
      expect(stdin.end).toHaveBeenCalled();
    });

    it('GIVEN no stdin option WHEN executed THEN stdin stream is closed without writing', async () => {
      const { child, stdin, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...baseOptions, bypassSemaphore: true });

      emitClose(0, null);
      await resultPromise;

      expect(stdin.write).not.toHaveBeenCalled();
      expect(stdin.end).toHaveBeenCalled();
    });
  });

  describe('timeout', () => {
    it('GIVEN a process exceeding timeoutMs WHEN timeout fires THEN timedOut is true and killProcess is called', async () => {
      vi.useFakeTimers();

      const { child, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...baseOptions, timeoutMs: 5_000, bypassSemaphore: true });

      vi.advanceTimersByTime(5_001);
      emitClose(null, 'SIGTERM');

      vi.useRealTimers();

      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
      expect(killProcess).toHaveBeenCalledWith(1234);
    });

    it('GIVEN a process with no pid WHEN timeout fires THEN killProcess is not called', async () => {
      vi.useFakeTimers();

      const { child, emitClose } = createControllableChild(null);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...baseOptions, timeoutMs: 5_000, bypassSemaphore: true });

      vi.advanceTimersByTime(5_001);
      emitClose(null, null);

      vi.useRealTimers();

      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
      expect(killProcess).not.toHaveBeenCalled();
    });
  });

  describe('output truncation', () => {
    it('GIVEN stdout exceeding MAX_OUTPUT_BYTES WHEN executed THEN output is truncated preserving partial chunk at boundary', async () => {
      const { child, emitStdout, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...baseOptions, bypassSemaphore: true });

      const firstChunkSize = MAX_OUTPUT_BYTES - 100;

      emitStdout(Buffer.alloc(firstChunkSize, 'a'));
      emitStdout(Buffer.alloc(200, 'b'));
      emitClose(0, null);

      const result = await resultPromise;

      expect(result.truncated).toBe(true);
      expect(result.stdoutBytes).toBe(MAX_OUTPUT_BYTES);
      expect(result.stdout).toHaveLength(MAX_OUTPUT_BYTES);
      expect(result.stdout.slice(-100)).toBe('b'.repeat(100));
      expect(result.stdout[firstChunkSize - 1]).toBe('a');
    });

    it('GIVEN stderr exceeding MAX_OUTPUT_BYTES WHEN executed THEN truncated flag is set', async () => {
      const { child, emitStderr, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...baseOptions, bypassSemaphore: true });

      emitStderr(Buffer.alloc(MAX_OUTPUT_BYTES + 1, 'x'));
      emitClose(0, null);

      const result = await resultPromise;

      expect(result.truncated).toBe(true);
      expect(result.stderrBytes).toBe(MAX_OUTPUT_BYTES);
    });
  });

  describe('spawn errors', () => {
    it('GIVEN crossSpawn emits error WHEN executed THEN rejects with CommandExecutionError', async () => {
      const { child, emitError } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...baseOptions, bypassSemaphore: true });

      emitError(new Error('ENOENT'));

      const error = (await resultPromise.catch((e: unknown) => e)) as CommandExecutionError;

      expect(error).toBeInstanceOf(CommandExecutionError);
      expect(error.message).toBe('Failed to spawn "/usr/bin/test-cli": ENOENT');
      expect(error.stderr).toBe('ENOENT');
      expect(error.cause).toBeInstanceOf(Error);
    });
  });

  describe('bypassSemaphore', () => {
    it('GIVEN bypassSemaphore is true WHEN executeCommand is called THEN it still executes and returns result', async () => {
      const child = makeAutoClosingChild({ stdout: 'hello', exitCode: 0 });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...baseOptions, bypassSemaphore: true });

      expect(result.stdout).toBe('hello');
      expect(result.exitCode).toBe(0);
      expect(crossSpawn).toHaveBeenCalledTimes(1);
    });

    it('GIVEN bypassSemaphore is false WHEN executeCommand is called THEN it executes normally', async () => {
      const child = makeAutoClosingChild({ stdout: 'world', exitCode: 0 });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...baseOptions, bypassSemaphore: false });

      expect(result.stdout).toBe('world');
      expect(result.exitCode).toBe(0);
    });

    it('GIVEN bypassSemaphore is true WHEN called THEN spawn is invoked and result is returned without semaphore gating', async () => {
      const child = makeAutoClosingChild({ stdout: 'bypassed', exitCode: 0 });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...baseOptions, bypassSemaphore: true });

      expect(crossSpawn).toHaveBeenCalledTimes(1);
      expect(result.stdout).toBe('bypassed');
      expect(result.exitCode).toBe(0);
    });
  });
});
