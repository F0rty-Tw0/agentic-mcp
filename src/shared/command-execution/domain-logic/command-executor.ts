import crossSpawn from 'cross-spawn';

import { setupIdleTimeout } from './command-idle-timeout.util';
import { attachStreamCollector } from './command-stream-collector.util';
import { createAbortSubscription, setupTimeout } from './command-timeout.util';
import { createSemaphore } from './semaphore';
import type { ExecuteCommandOptions, ExecutionResult, StreamCollector } from '../common';
import { CommandExecutionError } from '../common/errors';

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

const resolveExecutionResult = (input: ResolveExecutionResultInput): ExecutionResult => {
  const { stdout, stderr, exitCode, closeSignal, timedOut, startTime } = input;

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

const wrapChunkCallback = (
  idleTimeout: ReturnType<typeof setupIdleTimeout>,
  callback?: (chunk: string) => void
): ((chunk: string) => void) => {
  return (chunk: string): void => {
    idleTimeout.reset();
    callback?.(chunk);
  };
};

const spawnChild = async (options: ExecuteCommandOptions, startTime: number): Promise<ExecutionResult> => {
  const {
    binaryPath,
    args,
    env,
    timeoutMs,
    idleTimeoutMs,
    stdin,
    cwd,
    onStdoutChunk,
    onStderrChunk,
    signal,
    onSpawned,
  } = options;

  return new Promise<ExecutionResult>((resolve, reject) => {
    const child = crossSpawn(binaryPath, args, { env, stdio: [stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'], cwd });

    if (child.pid !== undefined && onSpawned) onSpawned(child.pid);

    const timeout = setupTimeout(timeoutMs, child.pid);
    const idleTimeout = setupIdleTimeout(idleTimeoutMs, child.pid);
    const stdout = attachStreamCollector(child.stdout, wrapChunkCallback(idleTimeout, onStdoutChunk));
    const stderr = attachStreamCollector(child.stderr, wrapChunkCallback(idleTimeout, onStderrChunk));
    const abort = createAbortSubscription(signal, child.pid);

    const cleanup = (): void => {
      clearTimeout(timeout.timer);
      idleTimeout.clear();
      abort.detach();
    };

    child.on('error', (error: Error) => {
      cleanup();
      reject(
        new CommandExecutionError(
          `Failed to spawn "${binaryPath}": ${error.message}`,
          { stderr: error.message },
          { cause: error }
        )
      );
    });

    child.on('close', (exitCode, closeSignal) => {
      cleanup();
      resolve(
        resolveExecutionResult({ stdout, stderr, exitCode, closeSignal, timedOut: timeout.markTimedOut(), startTime })
      );
    });

    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
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
