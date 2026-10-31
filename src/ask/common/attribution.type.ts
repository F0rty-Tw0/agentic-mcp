import type { OutputFormat } from '../../shared/mcp-protocol/common';

export type ProviderAttribution = {
  readonly provider: string;
  readonly model?: string;
  readonly executionTimeMs: number;
  readonly outputBytes: number;
  readonly truncated: boolean;
  readonly outputFormat: OutputFormat;
  readonly sessionMode?: string;
  readonly outputFormatObserved?: OutputFormat;
  readonly warning?: string;
};
