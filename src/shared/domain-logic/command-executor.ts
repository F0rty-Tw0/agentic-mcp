import crossSpawn from 'cross-spawn';

import { attachStreamCollector } from './command-stream-collector.util.ts';
import type { StreamCollector } from './command-stream-collector.util.ts';
import { createSemaphore } from './semaphore.ts';
import { CommandExecutionError } from '../common/errors/index.ts';
import type { ExecuteCommandOptions, ExecutionResult } from '../common/index.ts';
import { killProcess } from '../utils/index.ts';

type AbortSubscription = Readonly<{ abortHandler: () => void; detach: () => void }>;

const MAX_CONCURRENT_SPAWNS = 5;
const defaultSemaphore = createSemaphore(MAX_CONCURRENT_SPAWNS);

const createAbortSubscription = (signal: AbortSignal | undefined, childPid: number | undefined): AbortSubscription => {
  const abortHandler = (): void => {
    if (childPid != null) {
      void killProcess(childPid);
    }
  };

  if (!signal) {
    return { abortHandler, detach: () => undefined };
  }

  if (signal.aborted) abortHandler();

  signal.addEventListener('abort', abortHandler, { once: true });

  return {
    abortHandler,
    detach: (): void => {
      signal.removeEventListener('abort', abortHandler);
    },
  };
};

const setupTimeout = (
  pid: number | undefined,
  timeoutMs: number
): Readonly<{ timer: NodeJS.Timeout; markTimedOut: () => boolean }> => {
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;

    if (pid != null) {
      void killProcess(pid);
    }
  }, timeoutMs);

  return {
    timer,
    markTimedOut: () => timedOut,
  };
};

type ResolveExecutionResultInput = Readonly<{
  stdout: StreamCollector;
  stderr: StreamCollector;
  exitCode: number | null;
  closeSignal: string | null;
  timedOut: boolean;
  startTime: number;
}>;

const resolveExecutionResult = ({
  stdout,
  stderr,
  exitCode,
  closeSignal,
  timedOut,
  startTime,
}: ResolveExecutionResultInput): ExecutionResult => {
  return {
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
};

const spawnChild = async (options: ExecuteCommandOptions, startTime: number): Promise<ExecutionResult> => {
  const { binaryPath, args, env, timeoutMs, stdin, cwd, onStdoutChunk, onStderrChunk, signal, onSpawned } = options;

  return new Promise<ExecutionResult>((resolve, reject) => {
    const child = crossSpawn(binaryPath, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    });

    if (child.pid != null && onSpawned) {
      onSpawned(child.pid);
    }

    const timeout = setupTimeout(child.pid, timeoutMs);
    const stdout = attachStreamCollector(child.stdout, onStdoutChunk);
    const stderr = attachStreamCollector(child.stderr, onStderrChunk);
    const abort = createAbortSubscription(signal, child.pid ?? undefined);

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

      resolve(
        resolveExecutionResult({
          stdout,
          stderr,
          exitCode,
          closeSignal,
          timedOut: timeout.markTimedOut(),
          startTime,
        })
      );
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
