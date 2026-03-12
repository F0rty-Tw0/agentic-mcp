import crossSpawn from 'cross-spawn';

import { defaultProviderQueueStore } from './provider-queue';
import type {
  ExecuteCommandOptions,
  ExecutionResult,
  IdleTimeoutHandle,
  ProviderQueueOptions,
  StreamCollector,
} from '../common';
import { DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS, GLOBAL_MAX_CONCURRENT_SPAWNS } from '../common';
import { CommandExecutionError } from '../common/errors';
import { setupIdleTimeout } from '../utils/command-idle-timeout.util';
import { attachStreamCollector } from '../utils/command-stream-collector.util';
import { createAbortSubscription, setupTimeout } from '../utils/command-timeout.util';

type ResolveExecutionResultInput = Readonly<{
  stdout: StreamCollector;
  stderr: StreamCollector;
  exitCode: number | null;
  closeSignal: string | null;
  timedOut: boolean;
  startTime: number;
}>;

type QueueLease = Readonly<{ release: () => void }> | undefined;

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
  idleTimeout: IdleTimeoutHandle,
  callback?: (chunk: string) => void
): ((chunk: string) => void) => {
  return (chunk: string): void => {
    idleTimeout.reset();
    callback?.(chunk);
  };
};

const resolveProviderQueueOptions = (options: ExecuteCommandOptions): ProviderQueueOptions => {
  const providerQueue = options.providerQueue;

  if (providerQueue) {
    const providerQueueOptions: ProviderQueueOptions = { ...providerQueue, signal: options.signal };

    return providerQueueOptions;
  }

  const fallbackProviderQueueOptions: ProviderQueueOptions = {
    providerName: options.binaryPath,
    maxConcurrency: GLOBAL_MAX_CONCURRENT_SPAWNS,
    queueTimeoutMs: DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS,
    signal: options.signal,
  };

  return fallbackProviderQueueOptions;
};

const acquireQueueLease = async (options: ExecuteCommandOptions): Promise<QueueLease> => {
  const providerQueueOptions = resolveProviderQueueOptions(options);
  const lease = await defaultProviderQueueStore.acquireSlot(providerQueueOptions);

  return lease;
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

  const queueLease = await acquireQueueLease(options);

  try {
    return await spawnChild(options, startTime);
  } finally {
    queueLease?.release();
  }
};
