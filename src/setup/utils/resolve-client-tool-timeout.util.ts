import { DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS } from '../../shared/command-execution/common';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS, MAX_TIMER_DELAY_MS } from '../../shared/provider/common';
import type { ProviderConfig } from '../../shared/provider/common';
import type { ClientToolTimeout } from '../common';
import { CLIENT_TIMEOUT_MARGIN_MS } from '../common';

type ProviderTimeouts = Pick<ProviderConfig, 'enabled' | 'timeout' | 'queueTimeoutMs'>;

// Node clients (Gemini CLI, Copilot CLI) hand the value to setTimeout, which fires at once above 2^31-1 ms.
const capTimerDelay = (totalMs: number): number => {
  const cappedMs = Math.min(totalMs, MAX_TIMER_DELAY_MS);

  return cappedMs;
};

// 0 falls back to the default, as the ask handler and the provider queue do at run time.
const resolveRunMs = (provider: ProviderTimeouts): number => {
  const runMs = provider.timeout || DEFAULT_MCP_TOOL_TIMEOUT_MS;

  return runMs;
};

const resolveQueueMs = (provider: ProviderTimeouts): number => {
  const queueTimeoutMs = provider.queueTimeoutMs ?? 0;

  if (queueTimeoutMs > 0) return queueTimeoutMs;

  return DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS;
};

export const buildDefaultClientToolTimeout = (fallbackReason: string): ClientToolTimeout => {
  const totalMs = DEFAULT_MCP_TOOL_TIMEOUT_MS + DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS + CLIENT_TIMEOUT_MARGIN_MS;
  const defaultTimeout: ClientToolTimeout = {
    ms: capTimerDelay(totalMs),
    runMs: DEFAULT_MCP_TOOL_TIMEOUT_MS,
    queueMs: DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS,
    source: 'defaults',
    fallbackReason,
  };

  return defaultTimeout;
};

export const resolveClientToolTimeout = (providers: ProviderTimeouts[]): ClientToolTimeout => {
  const enabledProviders = providers.filter((provider) => provider.enabled);

  if (enabledProviders.length === 0) return buildDefaultClientToolTimeout('no provider is enabled in it');

  const runTimeouts = enabledProviders.map(resolveRunMs);
  const queueTimeouts = enabledProviders.map(resolveQueueMs);
  const runMs = Math.max(...runTimeouts);
  const queueMs = Math.max(...queueTimeouts);
  const totalMs = runMs + queueMs + CLIENT_TIMEOUT_MARGIN_MS;
  const configTimeout: ClientToolTimeout = {
    ms: capTimerDelay(totalMs),
    runMs,
    queueMs,
    source: 'providers-config',
  };

  return configTimeout;
};

export const describeClientToolTimeout = (timeout: ClientToolTimeout): string => {
  const { ms, runMs, queueMs, source, fallbackReason } = timeout;
  const isFromConfig = source === 'providers-config';
  const label = isFromConfig ? 'longest' : 'default';
  const origin = isFromConfig ? 'from the providers config' : `since ${String(fallbackReason)}`;
  const runPart = `${label} provider timeout ${String(runMs)}`;
  const queuePart = `${label} queueTimeoutMs ${String(queueMs)}`;
  const note = `agentic-mcp tool-call timeout: ${String(ms)} ms = ${runPart} + ${queuePart} + ${String(CLIENT_TIMEOUT_MARGIN_MS)}, ${origin}.`;

  return note;
};
