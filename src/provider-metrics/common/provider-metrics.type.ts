export type ProviderCallRecord = {
  readonly provider: string;
  readonly executionTimeMs: number;
  readonly success: boolean;
  readonly calledAt: string;
};

export type ProviderStats = {
  readonly provider: string;
  readonly totalCalls: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly totalExecutionTimeMs: number;
  readonly avgExecutionTimeMs: number;
  readonly lastCallAt: string;
};

export type ProviderMetricsSummary = {
  readonly collectedSince: string;
  readonly metricsFilePath: string;
  readonly totalCalls: number;
  readonly providers: ProviderStats[];
};
