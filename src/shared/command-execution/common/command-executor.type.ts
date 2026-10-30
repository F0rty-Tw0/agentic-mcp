import type { Readable } from 'node:stream';

export type StreamChunkCallback = (chunk: string) => void;

export type StdioReleasableChild = {
  readonly on: (event: 'exit', listener: () => void) => unknown;
  readonly stdout: Readable | null;
  readonly stderr: Readable | null;
};

export type StreamCollector = {
  readonly output: () => string;
  readonly bytes: () => number;
  readonly truncated: () => boolean;
};

type CommandEnv = Readonly<Record<string, string>>;

type RetryOperation<T> = () => Promise<T> | T;

export type IdleTimeoutHandle = {
  readonly reset: () => void;
  readonly clear: () => void;
  readonly timedOut: () => boolean;
};

export type RetryWithExponentialBackoffInput<T> = {
  readonly operation: RetryOperation<T>;
  readonly maxRetries: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
};

export type ProviderQueueOptions = {
  readonly providerName: string;
  readonly maxConcurrency: number;
  readonly queueTimeoutMs: number;
  readonly signal?: AbortSignal;
};

export type ExecuteCommandOptions = {
  readonly binaryPath: string;
  readonly args: string[];
  readonly env: CommandEnv;
  readonly timeoutMs: number;
  readonly idleTimeoutMs?: number;
  readonly stdin?: string;
  readonly cwd?: string;
  readonly bypassSemaphore?: boolean;
  readonly providerQueue?: ProviderQueueOptions;
  readonly onStdoutChunk?: StreamChunkCallback;
  readonly onStderrChunk?: StreamChunkCallback;
  readonly signal?: AbortSignal;
  readonly onSpawned?: (pid: number) => void;
};

export type ExecutionResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  readonly truncated: boolean;
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
  readonly executionTimeMs: number;
};
