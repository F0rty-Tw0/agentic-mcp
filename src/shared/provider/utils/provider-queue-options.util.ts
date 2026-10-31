import type { ProviderQueueOptions } from '../../command-execution/common';
import {
  DEFAULT_PROVIDER_MAX_CONCURRENCY,
  DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS,
  PROBE_QUEUE_TIMEOUT_MS,
} from '../../command-execution/common';
import type { ProviderConfig, ResolvedProviderEntry } from '../common';

type QueueConfigSource = Pick<ProviderConfig, 'maxConcurrency' | 'queueTimeoutMs'>;
type QueueContext = Pick<ResolvedProviderEntry, 'name' | 'config'>;

const resolveMaxConcurrency = (config: QueueConfigSource): number => {
  return config.maxConcurrency ?? DEFAULT_PROVIDER_MAX_CONCURRENCY;
};

const resolveQueueTimeoutMs = (config: QueueConfigSource): number => {
  return config.queueTimeoutMs ?? DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS;
};

export const buildProviderQueueOptions = (context: QueueContext): ProviderQueueOptions => {
  const providerQueueOptions: ProviderQueueOptions = {
    providerName: context.name,
    maxConcurrency: resolveMaxConcurrency(context.config),
    queueTimeoutMs: resolveQueueTimeoutMs(context.config),
  };

  return providerQueueOptions;
};

// ping and help are quick probes: they fail fast while the provider or the global spawn cap is busy.
export const buildProbeQueueOptions = (context: QueueContext): ProviderQueueOptions => {
  const providerQueueOptions = buildProviderQueueOptions(context);
  const queueTimeoutMs = Math.min(providerQueueOptions.queueTimeoutMs, PROBE_QUEUE_TIMEOUT_MS);
  const probeQueueOptions: ProviderQueueOptions = {
    ...providerQueueOptions,
    queueTimeoutMs,
    globalSlotExtraWaitMs: 0,
  };

  return probeQueueOptions;
};
