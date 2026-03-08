export type StreamChunkCallback = (chunk: string) => void;

export type StreamCollector = Readonly<{ output: () => string; bytes: () => number; truncated: () => boolean }>;

type CommandEnv = Readonly<Record<string, string>>;

export type ExecuteCommandOptions = Readonly<{
  binaryPath: string;
  args: readonly string[];
  env: CommandEnv;
  timeoutMs: number;
  idleTimeoutMs?: number;
  stdin?: string;
  cwd?: string;
  bypassSemaphore?: boolean;
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
