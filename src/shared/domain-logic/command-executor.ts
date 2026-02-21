import type { Readable } from 'node:stream';

import crossSpawn from 'cross-spawn';

import { createSemaphore } from './semaphore.ts';
import type { ExecuteCommandOptions, ExecutionResult } from '../common/command-executor.types.ts';
import { CommandExecutionError } from '../common/errors/command-execution.error.ts';
import { killProcess } from '../utils/platform.util.ts';

type CollectStreamResult = Readonly<{ bytes: number; truncated: boolean }>;

type StreamCollector = Readonly<{ output: () => string; bytes: () => number; truncated: () => boolean }>;

const MAX_CONCURRENT_SPAWNS = 5;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

const defaultSemaphore = createSemaphore(MAX_CONCURRENT_SPAWNS);

const collectStream = (chunks: Buffer[], chunk: Buffer, currentBytes: number): CollectStreamResult => {
  const newBytes = currentBytes + chunk.length;

  if (newBytes <= MAX_OUTPUT_BYTES) {
    chunks.push(chunk);

    const streamResult: CollectStreamResult = { bytes: newBytes, truncated: false };

    return streamResult;
  }

  const remaining = MAX_OUTPUT_BYTES - currentBytes;

  if (remaining > 0) chunks.push(chunk.subarray(0, remaining));

  const streamResult: CollectStreamResult = { bytes: currentBytes + remaining, truncated: true };

  return streamResult;
};

const attachStreamCollector = (stream: Readable | null): StreamCollector => {
  const chunks: Buffer[] = [];
  let currentBytes = 0;
  let isTruncated = false;

  stream?.on('data', (chunk: Buffer) => {
    const result = collectStream(chunks, chunk, currentBytes);

    currentBytes = result.bytes;

    if (result.truncated) isTruncated = true;
  });

  const streamCollector: StreamCollector = {
    output: () => Buffer.concat(chunks).toString('utf-8'),
    bytes: () => currentBytes,
    truncated: () => isTruncated,
  };

  return streamCollector;
};

const spawnChild = async (options: ExecuteCommandOptions, startTime: number): Promise<ExecutionResult> => {
  const { binaryPath, args, env, timeoutMs, stdin, cwd } = options;

  return new Promise<ExecutionResult>((resolve, reject) => {
    const child = crossSpawn(binaryPath, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    });

    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;

      if (child.pid != null) {
        void killProcess(child.pid);
      }
    }, timeoutMs);

    const stdout = attachStreamCollector(child.stdout);
    const stderr = attachStreamCollector(child.stderr);

    child.on('error', (error: Error) => {
      clearTimeout(timer);
      const commandError = new CommandExecutionError(
        `Failed to spawn "${binaryPath}": ${error.message}`,
        { stderr: error.message },
        { cause: error }
      );

      reject(commandError);
    });

    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);

      resolve({
        stdout: stdout.output(),
        stderr: stderr.output(),
        exitCode,
        signal,
        timedOut,
        truncated: stdout.truncated() || stderr.truncated(),
        stdoutBytes: stdout.bytes(),
        stderrBytes: stderr.bytes(),
        executionTimeMs: Date.now() - startTime,
      });
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
