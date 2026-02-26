import crossSpawn from 'cross-spawn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommand } from './command-executor';
import { CommandExecutionError } from '../common/errors';
import { TEST_EXECUTE_COMMAND_OPTIONS_STUB } from '../common/stubs';
import { createControllableChild } from '../common/test-utils';
import type { ControllableChild } from '../common/test-utils';
import { killProcess } from '../utils';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));

vi.mock('../utils/platform.util', () => ({
  killProcess: vi.fn().mockResolvedValue(true),
}));

type AutoClosingOptions = Readonly<{
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  signal?: string | null;
}>;

type ChildProcessLike = Record<string, unknown>;

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

const makeAutoClosingChild = (options: AutoClosingOptions = {}): ChildProcessLike => {
  const emitter = createControllableChild();

  scheduleAutoClose(emitter, resolveAutoClosingOptions(options));

  return emitter.child;
};

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

      const result = await executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true });

      expect(result.stdout).toBe('hello');
      expect(result.stderr).toBe('warn');
      expect(result.stdoutBytes).toBe(5);
      expect(result.stderrBytes).toBe(4);
      expect(result.truncated).toBe(false);
    });

    it('GIVEN command options WHEN executed THEN crossSpawn receives binaryPath, args, env, cwd, and stdio config', async () => {
      const child = makeAutoClosingChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      await executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, cwd: '/workspace', bypassSemaphore: true });

      expect(crossSpawn).toHaveBeenCalledWith('/usr/bin/test-cli', ['run'], {
        env: TEST_EXECUTE_COMMAND_OPTIONS_STUB.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: '/workspace',
      });
    });

    it('GIVEN a completed command WHEN result is returned THEN executionTimeMs is a non-negative number', async () => {
      const child = makeAutoClosingChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true });

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('exit codes and signals', () => {
    it('GIVEN a process exiting with non-zero code WHEN executed THEN exitCode is returned', async () => {
      const child = makeAutoClosingChild({ exitCode: 42 });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true });

      expect(result.exitCode).toBe(42);
      expect(result.signal).toBeNull();
      expect(result.timedOut).toBe(false);
    });

    it('GIVEN a process killed by signal WHEN executed THEN signal is returned with null exitCode', async () => {
      const child = makeAutoClosingChild({ exitCode: null, signal: 'SIGTERM' });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true });

      expect(result.exitCode).toBeNull();
      expect(result.signal).toBe('SIGTERM');
    });
  });

  describe('stdin', () => {
    it('GIVEN stdin option WHEN executed THEN stdin data is written and stream is closed', async () => {
      const { child, stdin, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        stdin: 'input data',
        bypassSemaphore: true,
      });

      emitClose(0, null);
      await resultPromise;

      expect(stdin.write).toHaveBeenCalledWith('input data');
      expect(stdin.end).toHaveBeenCalled();
    });

    it('GIVEN no stdin option WHEN executed THEN stdin stream is closed without writing', async () => {
      const { child, stdin, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true });

      emitClose(0, null);
      await resultPromise;

      expect(stdin.write).not.toHaveBeenCalled();
      expect(stdin.end).toHaveBeenCalled();
    });
  });

  describe('timeout', () => {
    it('GIVEN a process exceeding timeoutMs WHEN timeout fires THEN timedOut is true and killProcess is called', async () => {
      vi.useFakeTimers();

      const { child, emitClose } = createControllableChild(1234);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        timeoutMs: 5_000,
        bypassSemaphore: true,
      });

      vi.advanceTimersByTime(5_001);
      emitClose(null, 'SIGTERM');

      vi.useRealTimers();

      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
      expect(killProcess).toHaveBeenCalledWith(1234);
    });

    it('GIVEN a process with no pid WHEN timeout fires THEN killProcess is not called', async () => {
      vi.useFakeTimers();

      const { child, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        timeoutMs: 5_000,
        bypassSemaphore: true,
      });

      vi.advanceTimersByTime(5_001);
      emitClose(null, null);

      vi.useRealTimers();

      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
      expect(killProcess).not.toHaveBeenCalled();
    });
  });

  describe('spawn errors', () => {
    it('GIVEN crossSpawn emits error WHEN executed THEN rejects with CommandExecutionError', async () => {
      const { child, emitError } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true });

      emitError(new Error('ENOENT'));

      const error = (await resultPromise.catch((e: unknown) => e)) as CommandExecutionError;

      expect(error).toBeInstanceOf(CommandExecutionError);
      expect(error.message).toBe('Failed to spawn "/usr/bin/test-cli": ENOENT');
      expect(error.stderr).toBe('ENOENT');
      expect(error.cause).toBeInstanceOf(Error);
    });
  });

  describe('abort signal', () => {
    it('GIVEN an AbortSignal WHEN signal fires after spawn THEN killProcess is called with child pid', async () => {
      const controller = new AbortController();
      const { child, emitClose } = createControllableChild(5678);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        signal: controller.signal,
        bypassSemaphore: true,
      });

      controller.abort();
      emitClose(null, 'SIGTERM');

      await resultPromise;

      expect(killProcess).toHaveBeenCalledWith(5678);
    });

    it('GIVEN an already-aborted signal WHEN executeCommand is called THEN killProcess is called immediately', async () => {
      const controller = new AbortController();

      controller.abort();

      const { child, emitClose } = createControllableChild(9999);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        signal: controller.signal,
        bypassSemaphore: true,
      });

      emitClose(null, 'SIGTERM');

      await resultPromise;

      expect(killProcess).toHaveBeenCalledWith(9999);
    });

    it('GIVEN an AbortSignal with no-pid child WHEN signal fires THEN killProcess is not called', async () => {
      const controller = new AbortController();
      const { child, emitClose } = createControllableChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({
        ...TEST_EXECUTE_COMMAND_OPTIONS_STUB,
        signal: controller.signal,
        bypassSemaphore: true,
      });

      controller.abort();
      emitClose(null, null);

      await resultPromise;

      expect(killProcess).not.toHaveBeenCalled();
    });
  });

  describe('onSpawned callback', () => {
    it('GIVEN onSpawned callback and child with pid WHEN spawned THEN callback receives pid', async () => {
      const onSpawned = vi.fn();
      const { child, emitClose } = createControllableChild(4321);

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const resultPromise = executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, onSpawned, bypassSemaphore: true });

      emitClose(0, null);
      await resultPromise;

      expect(onSpawned).toHaveBeenCalledWith(4321);
    });

    it('GIVEN onSpawned callback and child without pid WHEN spawned THEN callback is not called', async () => {
      const onSpawned = vi.fn();
      const child = makeAutoClosingChild();

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      await executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, onSpawned, bypassSemaphore: true });

      expect(onSpawned).not.toHaveBeenCalled();
    });
  });

  describe('bypassSemaphore', () => {
    it('GIVEN bypassSemaphore is true WHEN executeCommand is called THEN it still executes and returns result', async () => {
      const child = makeAutoClosingChild({ stdout: 'hello', exitCode: 0 });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true });

      expect(result.stdout).toBe('hello');
      expect(result.exitCode).toBe(0);
      expect(crossSpawn).toHaveBeenCalledTimes(1);
    });

    it('GIVEN bypassSemaphore is false WHEN executeCommand is called THEN it executes normally', async () => {
      const child = makeAutoClosingChild({ stdout: 'world', exitCode: 0 });

      vi.mocked(crossSpawn).mockReturnValue(child as unknown as ReturnType<typeof crossSpawn>);

      const result = await executeCommand({ ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: false });

      expect(result.stdout).toBe('world');
      expect(result.exitCode).toBe(0);
    });
  });
});
