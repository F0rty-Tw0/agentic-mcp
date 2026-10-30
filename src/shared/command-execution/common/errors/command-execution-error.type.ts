export type CommandExecutionErrorDetails = {
  readonly exitCode?: number | null;
  readonly signal?: string | null;
  readonly timedOut?: boolean;
  readonly stderr?: string;
  readonly output?: string;
};

export type QueueTimeoutErrorDetails = {
  readonly providerName: string;
  readonly waitMs: number;
  readonly queueTimeoutMs: number;
};
