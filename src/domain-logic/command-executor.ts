import crossSpawn from 'cross-spawn';

import { CommandExecutionError } from '../common/errors/command-execution.error.ts';
import { killProcess } from '../utils/platform.ts';

type ExecuteCommandOptions = Readonly<{
  binaryPath: string;
  args: readonly string[];
  env: Record<string, string>;
  timeoutMs: number;
  stdin?: string;
  cwd?: string;
}>;

type ExecutionResult = Readonly<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  truncated: boolean;
  stdoutBytes: number;
  stderrBytes: number;
  executionTimeMs: number;
}>;

type CollectStreamResult = Readonly<{
  bytes: number;
  truncated: boolean;
}>;

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

const MAX_CONCURRENT_SPAWNS = 5;

// Concurrency semaphore
let activeSpawns = 0;
const waitQueue: Array<() => void> = [];

const acquireSlot = async (): Promise<void> => {
  if (activeSpawns < MAX_CONCURRENT_SPAWNS) {
    activeSpawns++;

    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
};

const releaseSlot = (): void => {
  activeSpawns--;
  const next = waitQueue.shift();

  if (next) {
    activeSpawns++;
    next();
  }
};

const collectStream = (chunks: Buffer[], chunk: Buffer, currentBytes: number): CollectStreamResult => {
  const newBytes = currentBytes + chunk.length;

  if (newBytes <= MAX_OUTPUT_BYTES) {
    chunks.push(chunk);

    return { bytes: newBytes, truncated: false };
  }

  return { bytes: newBytes, truncated: true };
};

// eslint-disable-next-line max-lines-per-function -- spawn logic is inherently monolithic
const spawnChild = async (options: ExecuteCommandOptions, startTime: number): Promise<ExecutionResult> => {
  const { binaryPath, args, env, timeoutMs, stdin, cwd } = options;

  // eslint-disable-next-line max-lines-per-function -- spawn lifecycle is a single unit
  return new Promise<ExecutionResult>((resolve, reject) => {
    const child = crossSpawn(binaryPath, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncated = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;

      if (child.pid != null) {
        void killProcess(child.pid);
      }
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      const result = collectStream(stdoutChunks, chunk, stdoutBytes);

      stdoutBytes = result.bytes;

      if (result.truncated) truncated = true;
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const result = collectStream(stderrChunks, chunk, stderrBytes);

      stderrBytes = result.bytes;

      if (result.truncated) truncated = true;
    });

    child.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(
        new CommandExecutionError(
          `Failed to spawn "${binaryPath}": ${error.message}`,
          { stderr: error.message },
          { cause: error },
        ),
      );
    });

    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);

      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        exitCode: exitCode ?? null,
        signal: signal ?? null,
        timedOut,
        truncated,
        stdoutBytes,
        stderrBytes,
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
  await acquireSlot();
  const startTime = Date.now();

  try {
    return await spawnChild(options, startTime);
  } finally {
    releaseSlot();
  }
};
