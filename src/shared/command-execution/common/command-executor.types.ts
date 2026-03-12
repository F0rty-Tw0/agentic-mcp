export type StreamChunkCallback = (chunk: string) => void;

export type StreamCollector = Readonly<{ output: () => string; bytes: () => number; truncated: () => boolean }>;

type CommandEnv = Readonly<Record<string, string>>;

type RetryOperation<T> = () => Promise<T> | T;

export type IdleTimeoutHandle = Readonly<{ reset: () => void; clear: () => void }>;

export type RetryWithExponentialBackoffInput<T> = Readonly<{
  operation: RetryOperation<T>;
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}>;

export type ProviderQueueOptions = Readonly<{
  providerName: string;
  maxConcurrency: number;
  queueTimeoutMs: number;
}>;

export type ExecuteCommandOptions = Readonly<{
  binaryPath: string;
  args: readonly string[];
  env: CommandEnv;
  timeoutMs: number;
  idleTimeoutMs?: number;
  stdin?: string;
  cwd?: string;
  bypassSemaphore?: boolean;
  providerQueue?: ProviderQueueOptions;
  onStdoutChunk?: StreamChunkCallback;
  onStderrChunk?: StreamChunkCallback;
  signal?: AbortSignal;
  onSpawned?: (pid: number) => void;
}>;

export type ExecutionResult = Readonly<{
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
