export type AskAllToolArgs = {
  readonly prompt: string;
  readonly providers?: string[];
  readonly model?: string;
  readonly context?: string;
  readonly working_directory?: string;
  readonly system_prompt?: string;
};

export type AskAllProviderResult = {
  readonly provider: string;
  readonly success: boolean;
  readonly executionTimeMs: number;
  readonly response?: string;
  readonly error?: string;
};

export type AskAllResult = {
  readonly prompt: string;
  readonly totalProviders: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly totalExecutionTimeMs: number;
  readonly results: AskAllProviderResult[];
};
