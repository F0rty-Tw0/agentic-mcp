import type { ProviderCallRecord } from './provider-metrics.type';

export type ProviderMetricsFile = {
  readonly collectedSince: string;
  readonly records: ProviderCallRecord[];
};
