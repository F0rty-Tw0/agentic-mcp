import type { ChildProcess, StdioOptions } from 'node:child_process';
import process from 'node:process';

import crossSpawn from 'cross-spawn';

import { defaultProviderQueueStore } from './provider-queue';
import type { ExecuteCommandOptions, ExecutionResult, ProviderQueueOptions, UntrackChildGroup } from '../common';
import { DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS, GLOBAL_MAX_CONCURRENT_SPAWNS } from '../common';
import { defaultChildGroupRegistry } from './child-group-registry';
import { setupIdleTimeout } from './command-idle-timeout';
import { setupResultExitWatch } from './command-result-exit';
import { releaseStdioAfterKilledExit } from './command-stdio-release';
import { createAbortSubscription, setupTimeout } from './command-timeout';
import { CommandExecutionError } from '../common/errors';
import type { ProviderQueueLease } from '../common/provider-queue.type';
import { wrapChunkCallback, wrapStdoutCallback } from '../utils/command-chunk-callback.util';
import { attachStreamCollector } from '../utils/command-stream-collector.util';
import { resolveExecutionResult, resolveTimeoutCause } from '../utils/execution-result.util';

type QueueLease = ProviderQueueLease | undefined;

// A CLI that exits before reading stdin fails the write with EPIPE; its exit code already reports the failure.
const ignoreStdinError = (): void => undefined;

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

const noopUntrack: UntrackChildGroup = () => undefined;

// POSIX: lead a new process group so killProcess(-pid) also reaches descendants; Windows uses taskkill /T.
const isDetachedPlatform = (): boolean => process.platform !== 'win32';

const spawnProcess = (options: ExecuteCommandOptions): ChildProcess => {
  const { binaryPath, args, env, stdin, cwd } = options;
  const stdio: StdioOptions = [stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'];
  const detached = isDetachedPlatform();
  const child = crossSpawn(binaryPath, args, { env, stdio, cwd, detached });

  return child;
};

const trackChildGroup = (child: ChildProcess): UntrackChildGroup => {
  const detached = isDetachedPlatform();

  if (!detached || child.pid === undefined) return noopUntrack;

  const untrack = defaultChildGroupRegistry.track(child.pid);

  return untrack;
};

const writeStdin = (child: ChildProcess, stdin?: string): void => {
  if (!stdin || !child.stdin) return;

  child.stdin.on('error', ignoreStdinError);
  child.stdin.write(stdin);
  child.stdin.end();
};

const spawnChild = async (options: ExecuteCommandOptions, startTime: number): Promise<ExecutionResult> => {
  const { binaryPath, timeoutMs, idleTimeoutMs, stdin, onStdoutChunk, onStderrChunk, signal, onSpawned } = options;

  return new Promise<ExecutionResult>((resolve, reject) => {
    const child = spawnProcess(options);
    const untrackGroup = trackChildGroup(child);

    if (child.pid !== undefined && onSpawned) onSpawned(child.pid);

    const timeout = setupTimeout(timeoutMs, child.pid);
    const idleTimeout = setupIdleTimeout(idleTimeoutMs, child.pid);
    const resultExitWatch = setupResultExitWatch(options, child.pid);
    const stdout = attachStreamCollector(child.stdout, wrapStdoutCallback(idleTimeout, resultExitWatch, onStdoutChunk));
    const stderr = attachStreamCollector(child.stderr, wrapChunkCallback(idleTimeout, onStderrChunk));
    const abort = createAbortSubscription(signal, child.pid);
    const wasStoppedByWatch = (): boolean =>
      timeout.markTimedOut() || idleTimeout.timedOut() || resultExitWatch.stopped();
    const wasKillRequested = (): boolean => wasStoppedByWatch() || signal?.aborted === true;
    const cancelStdioRelease = releaseStdioAfterKilledExit(child, wasKillRequested);

    const cleanup = (): void => {
      clearTimeout(timeout.timer);
      idleTimeout.clear();
      resultExitWatch.clear();
      abort.detach();
      cancelStdioRelease();
      untrackGroup();
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
      const timeoutCause = resolveTimeoutCause({
        wallClockTimedOut: timeout.markTimedOut(),
        idleTimedOut: idleTimeout.timedOut(),
        resultExitStopped: resultExitWatch.stopped(),
        timeoutMs,
        idleTimeoutMs,
      });

      const executionTimeMs = Date.now() - startTime;

      resolve(resolveExecutionResult({ stdout, stderr, exitCode, closeSignal, timeoutCause, executionTimeMs }));
    });

    writeStdin(child, stdin);
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
