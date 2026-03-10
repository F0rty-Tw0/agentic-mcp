export type ProviderCallRecord = Readonly<{
  provider: string;
  executionTimeMs: number;
  success: boolean;
  calledAt: string;
}>;

export type ProviderStats = Readonly<{
  provider: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  totalExecutionTimeMs: number;
  avgExecutionTimeMs: number;
  lastCallAt: string;
}>;

export type ProviderMetricsSummary = Readonly<{
  collectedSince: string;
  totalCalls: number;
  providers: readonly ProviderStats[];
}>;
