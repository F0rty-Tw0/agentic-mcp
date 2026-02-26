import type { OutputFormat } from '../../shared/common';

export type ProviderAttribution = Readonly<{
  provider: string;
  model?: string;
  executionTimeMs: number;
  outputBytes: number;
  truncated: boolean;
  outputFormat: OutputFormat;
  sessionMode?: string;
  outputFormatObserved?: OutputFormat;
}>;
