import crossSpawn from 'cross-spawn';

import { CommandExecutionError } from '../common/errors/command-execution.error.ts';
import { MAX_CONCURRENT_SPAWNS, MAX_OUTPUT_BYTES } from '../common/execution-limits.const.ts';
import { killProcess } from '../utils/platform.ts';

export type ExecuteCommandOptions = {
  binaryPath: string;
  args: string[];
  env: Record<string, string>;
  timeoutMs: number;
  stdin?: string;
  cwd?: string;
};

export type ExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  truncated: boolean;
  stdoutBytes: number;
  stderrBytes: number;
  executionTimeMs: number;
};

// Concurrency semaphore
let activeSpawns = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeSpawns < MAX_CONCURRENT_SPAWNS) {
    activeSpawns++;

    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
}

function releaseSlot(): void {
  activeSpawns--;
  const next = waitQueue.shift();

  if (next) {
    activeSpawns++;
    next();
  }
}

function collectStream(
  chunks: Buffer[],
  chunk: Buffer,
  currentBytes: number,
): { bytes: number; truncated: boolean } {
  const newBytes = currentBytes + chunk.length;

  if (newBytes <= MAX_OUTPUT_BYTES) {
    chunks.push(chunk);

    return { bytes: newBytes, truncated: false };
  }

  return { bytes: newBytes, truncated: true };
}

// eslint-disable-next-line max-lines-per-function -- spawn logic is inherently monolithic
async function spawnChild(
  options: ExecuteCommandOptions,
  startTime: number,
): Promise<ExecutionResult> {
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
}

export async function executeCommand(options: ExecuteCommandOptions): Promise<ExecutionResult> {
  await acquireSlot();
  const startTime = Date.now();

  try {
    return await spawnChild(options, startTime);
  } finally {
    releaseSlot();
  }
}
