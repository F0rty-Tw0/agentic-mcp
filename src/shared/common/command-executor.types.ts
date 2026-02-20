export type ExecuteCommandOptions = Readonly<{
  binaryPath: string;
  args: readonly string[];
  env: Readonly<Record<string, string>>;
  timeoutMs: number;
  stdin?: string;
  cwd?: string;
  bypassSemaphore?: boolean;
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
