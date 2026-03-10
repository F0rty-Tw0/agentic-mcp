import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProviderMetricsToolDefinition, handleProviderMetrics } from './provider-metrics.handler';
import { getProviderMetrics } from '../data-access/provider-metrics-store';

vi.mock('../data-access/provider-metrics-store', () => ({
  getProviderMetrics: vi.fn(),
}));

describe('handleProviderMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN a provider metrics summary WHEN called THEN returns it as JSON text content', async () => {
    const fakeSummary = {
      collectedSince: '2026-01-01T00:00:00.000Z',
      totalCalls: 3,
      providers: [
        {
          provider: 'claude',
          totalCalls: 3,
          successCount: 2,
          failureCount: 1,
          totalExecutionTimeMs: 600,
          avgExecutionTimeMs: 200,
          lastCallAt: '2026-01-01T00:01:00.000Z',
        },
      ],
    };

    vi.mocked(getProviderMetrics).mockResolvedValue(fakeSummary);

    const result = await handleProviderMetrics();

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toStrictEqual({
      type: 'text',
      text: JSON.stringify(fakeSummary, null, 2),
    });
  });

  it('GIVEN provider metrics summary WHEN called THEN delegates to getProviderMetrics', async () => {
    vi.mocked(getProviderMetrics).mockResolvedValue({
      collectedSince: '2026-01-01T00:00:00.000Z',
      totalCalls: 0,
      providers: [],
    });

    await handleProviderMetrics();

    expect(getProviderMetrics).toHaveBeenCalledOnce();
  });
});

describe('buildProviderMetricsToolDefinition', () => {
  it('GIVEN no arguments WHEN called THEN returns name "provider_metrics"', () => {
    const def = buildProviderMetricsToolDefinition();

    expect(def.name).toBe('provider_metrics');
  });

  it('GIVEN no arguments WHEN called THEN description mentions provider and overall usage', () => {
    const def = buildProviderMetricsToolDefinition();

    expect(def.description).toContain('provider');
    expect(def.description).toContain('overall');
  });

  it('GIVEN no arguments WHEN called THEN has readOnly and idempotent annotations', () => {
    const def = buildProviderMetricsToolDefinition();

    expect(def.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
  });

  it('GIVEN no arguments WHEN called THEN inputSchema is undefined', () => {
    const def = buildProviderMetricsToolDefinition();

    expect(def.inputSchema).toBeUndefined();
  });
});
