import crossSpawn from 'cross-spawn';

import { attachStreamCollector } from './command-stream-collector.util';
import { createSemaphore } from './semaphore';
import type { ExecuteCommandOptions, ExecutionResult, StreamCollector } from '../common';
import { CommandExecutionError } from '../common/errors';
import { killProcess } from '../utils';

type AbortSubscription = Readonly<{ abortHandler: () => void; detach: () => void }>;
type ResolveExecutionResultInput = Readonly<{
  stdout: StreamCollector;
  stderr: StreamCollector;
  exitCode: number | null;
  closeSignal: string | null;
  timedOut: boolean;
  startTime: number;
}>;

const MAX_CONCURRENT_SPAWNS = 5;
const defaultSemaphore = createSemaphore(MAX_CONCURRENT_SPAWNS);

const createAbortSubscription = (signal?: AbortSignal, childPid?: number): AbortSubscription => {
  const abortHandler = (): void => {
    if (childPid === undefined) return;

    void killProcess(childPid);
  };

  if (!signal) {
    const abortSubscription: AbortSubscription = { abortHandler, detach: () => undefined };

    return abortSubscription;
  }

  if (signal.aborted) abortHandler();

  signal.addEventListener('abort', abortHandler, { once: true });

  const abortSubscription: AbortSubscription = {
    abortHandler,
    detach: (): void => {
      signal.removeEventListener('abort', abortHandler);
    },
  };

  return abortSubscription;
};

type TimeoutHandle = Readonly<{ timer: NodeJS.Timeout; markTimedOut: () => boolean }>;

const setupTimeout = (timeoutMs: number, pid?: number): TimeoutHandle => {
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;

    if (pid === undefined) return;

    void killProcess(pid);
  }, timeoutMs);

  return {
    timer,
    markTimedOut: () => timedOut,
  };
};

const resolveExecutionResult = (resolveExecutionResultInput: ResolveExecutionResultInput): ExecutionResult => {
  const { stdout, stderr, exitCode, closeSignal, timedOut, startTime } = resolveExecutionResultInput;
  const executionResult: ExecutionResult = {
    stdout: stdout.output(),
    stderr: stderr.output(),
    exitCode,
    signal: closeSignal,
    timedOut,
    truncated: stdout.truncated() || stderr.truncated(),
    stdoutBytes: stdout.bytes(),
    stderrBytes: stderr.bytes(),
    executionTimeMs: Date.now() - startTime,
  };

  return executionResult;
};

const spawnChild = async (options: ExecuteCommandOptions, startTime: number): Promise<ExecutionResult> => {
  const { binaryPath, args, env, timeoutMs, stdin, cwd, onStdoutChunk, onStderrChunk, signal, onSpawned } = options;

  return new Promise<ExecutionResult>((resolve, reject) => {
    const child = crossSpawn(binaryPath, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    });

    if (child.pid !== undefined && onSpawned) {
      onSpawned(child.pid);
    }

    const timeout = setupTimeout(timeoutMs, child.pid);
    const stdout = attachStreamCollector(child.stdout, onStdoutChunk);
    const stderr = attachStreamCollector(child.stderr, onStderrChunk);
    const abort = createAbortSubscription(signal, child.pid);

    child.on('error', (error: Error) => {
      clearTimeout(timeout.timer);
      abort.detach();
      const commandError = new CommandExecutionError(
        `Failed to spawn "${binaryPath}": ${error.message}`,
        { stderr: error.message },
        { cause: error }
      );

      reject(commandError);
    });

    child.on('close', (exitCode, closeSignal) => {
      clearTimeout(timeout.timer);
      abort.detach();

      const executionResultInput: ResolveExecutionResultInput = {
        stdout,
        stderr,
        exitCode,
        closeSignal,
        timedOut: timeout.markTimedOut(),
        startTime,
      };

      resolve(resolveExecutionResult(executionResultInput));
    });

    // Write stdin if provided, then close the stream
    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    } else {
      child.stdin?.end();
    }
  });
};

export const executeCommand = async (options: ExecuteCommandOptions): Promise<ExecutionResult> => {
  const startTime = Date.now();

  if (options.bypassSemaphore) return spawnChild(options, startTime);

  await defaultSemaphore.acquireSlot();

  try {
    return await spawnChild(options, startTime);
  } finally {
    defaultSemaphore.releaseSlot();
  }
};
