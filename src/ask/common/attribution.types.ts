export type ProviderAttribution = Readonly<{
  provider: string;
  model?: string;
  executionTimeMs: number;
  outputBytes: number;
  truncated: boolean;
  outputFormat: 'json' | 'stream-json' | 'text';
  sessionMode?: string;
  outputFormatObserved?: string;
}>;
