import type { ChildProcess, StdioOptions } from 'node:child_process';
import process from 'node:process';

import crossSpawn from 'cross-spawn';

import { defaultProviderQueueStore } from './provider-queue';
import type {
  ExecuteCommandOptions,
  ExecutionResult,
  ProviderQueueOptions,
  StopChild,
  UntrackChildGroup,
} from '../common';
import { DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS, GLOBAL_MAX_CONCURRENT_SPAWNS } from '../common';
import { defaultChildGroupRegistry } from './child-group-registry';
import { setupIdleTimeout } from './command-idle-timeout';
import { setupResultExitWatch } from './command-result-exit';
import { releaseStdioAfterKilledExit, trackExitBeforeKill } from './command-stdio-release';
import { createAbortSubscription, setupTimeout } from './command-timeout';
import { killProcess } from './platform';
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

const buildStopChild = (pid: number | undefined): StopChild | undefined => {
  if (pid === undefined) return;

  const stopChild: StopChild = (): void => {
    void killProcess(pid);
  };

  return stopChild;
};

const writeStdin = (child: ChildProcess, stdin?: string): void => {
  if (!stdin || !child.stdin) return;

  child.stdin.on('error', ignoreStdinError);
  child.stdin.write(stdin);
  child.stdin.end();
};

const buildSpawnError = (binaryPath: string, error: Error): CommandExecutionError => {
  const message = `Failed to spawn "${binaryPath}": ${error.message}`;
  const spawnError = new CommandExecutionError(message, { stderr: error.message }, { cause: error });

  return spawnError;
};

const spawnChild = async (options: ExecuteCommandOptions, startTime: number): Promise<ExecutionResult> => {
  const { binaryPath, timeoutMs, idleTimeoutMs, stdin, onStdoutChunk, onStderrChunk, signal, onSpawned } = options;

  return new Promise<ExecutionResult>((resolve, reject) => {
    const child = spawnProcess(options);
    const untrackGroup = trackChildGroup(child);

    if (child.pid !== undefined && onSpawned) onSpawned(child.pid);

    const stopChild = buildStopChild(child.pid);
    const timeout = setupTimeout(timeoutMs, stopChild);
    const idleTimeout = setupIdleTimeout(idleTimeoutMs, stopChild);
    const resultExitWatch = setupResultExitWatch(options, stopChild);
    const stdout = attachStreamCollector(child.stdout, wrapStdoutCallback(idleTimeout, resultExitWatch, onStdoutChunk));
    const stderr = attachStreamCollector(child.stderr, wrapChunkCallback(idleTimeout, onStderrChunk));
    const abort = createAbortSubscription(signal, stopChild);
    const wasStoppedByWatch = (): boolean =>
      timeout.markTimedOut() || idleTimeout.timedOut() || resultExitWatch.stopped();
    const wasKillRequested = (): boolean => wasStoppedByWatch() || signal?.aborted === true;
    const cancelStdioRelease = releaseStdioAfterKilledExit(child, wasKillRequested);
    const exitedBeforeKill = trackExitBeforeKill(child, wasKillRequested);

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
      reject(buildSpawnError(binaryPath, error));
    });

    child.on('close', (exitCode, closeSignal) => {
      cleanup();
      const timeoutCause = resolveTimeoutCause({
        wallClockTimedOut: timeout.markTimedOut(),
        idleTimedOut: idleTimeout.timedOut(),
        resultExitStopped: resultExitWatch.stopped(),
        exitedBeforeKill: exitedBeforeKill(),
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
