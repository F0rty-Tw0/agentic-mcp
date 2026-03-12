import type { ProviderQueueOptions } from '../../command-execution/common';
import { DEFAULT_PROVIDER_MAX_CONCURRENCY, DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS } from '../../command-execution/common';
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
