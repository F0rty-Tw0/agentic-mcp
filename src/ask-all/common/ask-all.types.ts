export type AskAllToolArgs = Readonly<{
  prompt: string;
  providers?: readonly string[];
  model?: string;
  context?: string;
  working_directory?: string;
  system_prompt?: string;
}>;

export type AskAllProviderResult = Readonly<{
  provider: string;
  success: boolean;
  executionTimeMs: number;
  response?: string;
  error?: string;
}>;

export type AskAllResult = Readonly<{
  prompt: string;
  totalProviders: number;
  succeeded: number;
  failed: number;
  totalExecutionTimeMs: number;
  results: readonly AskAllProviderResult[];
}>;
