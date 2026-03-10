import type { ProviderCallRecord } from './provider-metrics.types';

export type ProviderMetricsFile = Readonly<{
  collectedSince: string;
  records: readonly ProviderCallRecord[];
}>;
