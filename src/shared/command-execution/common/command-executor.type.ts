import type { Readable } from 'node:stream';

export type StreamChunkCallback = (chunk: string) => void;

export type UntrackChildGroup = () => void;

export type StopChild = () => void;

export type ChildStop = {
  readonly stop: StopChild | undefined;
  readonly exitedBeforeStop: () => boolean;
  readonly cancelRelease: () => void;
};

export type ChildGroupRegistry = {
  readonly track: (pid: number) => UntrackChildGroup;
  readonly terminateAll: () => void;
};

export type StoppableChild = {
  readonly pid?: number;
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

export type ResultCompleteDetector = (chunk: string) => boolean;

export type ResultExitWatch = {
  readonly observe: (chunk: string) => void;
  readonly clear: () => void;
  readonly stopped: () => boolean;
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
  readonly globalSlotExtraWaitMs?: number;
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
  readonly isResultComplete?: ResultCompleteDetector;
  readonly resultExitGraceMs?: number;
};

export type ExecutionTimeoutKind = 'wall-clock' | 'idle' | 'result-exit';

export type ExecutionTimeoutCause = {
  readonly kind: ExecutionTimeoutKind;
  readonly limitMs: number;
  readonly outputHeldAfterExit?: boolean;
};

export type ResolveExecutionResultInput = {
  readonly stdout: StreamCollector;
  readonly stderr: StreamCollector;
  readonly exitCode: number | null;
  readonly closeSignal: string | null;
  readonly timeoutCause?: ExecutionTimeoutCause;
  readonly executionTimeMs: number;
};

export type ResolveTimeoutCauseInput = {
  readonly wallClockTimedOut: boolean;
  readonly idleTimedOut: boolean;
  readonly resultExitStopped: boolean;
  readonly exitedBeforeKill?: boolean;
  readonly timeoutMs: number;
  readonly idleTimeoutMs?: number;
};

export type ExecutionResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  readonly timeoutCause?: ExecutionTimeoutCause;
  readonly truncated: boolean;
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
  readonly executionTimeMs: number;
};
