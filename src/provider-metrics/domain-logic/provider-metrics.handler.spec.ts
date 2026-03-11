import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProviderMetricsToolDefinition, handleProviderMetrics } from './provider-metrics.handler';
import { getProviderMetrics } from '../data-access/provider-metrics-store';

vi.mock('../data-access/provider-metrics-store', () => ({
  getProviderMetrics: vi.fn(),
}));

describe('handleProviderMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN a provider metrics summary WHEN called THEN returns it as JSON text content', async () => {
    const fakeSummary = {
      collectedSince: '2026-01-01T00:00:00.000Z',
      metricsFilePath: '/tmp/provider-metrics.json',
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
      metricsFilePath: '/tmp/provider-metrics.json',
      totalCalls: 0,
      providers: [],
    });

    await handleProviderMetrics();

    expect(getProviderMetrics).toHaveBeenCalledOnce();
  });

  it('GIVEN provider metrics retrieval failure WHEN called THEN returns an MCP error response', async () => {
    vi.mocked(getProviderMetrics).mockRejectedValue(new Error('metrics unavailable'));

    const result = await handleProviderMetrics();

    expect(result).toStrictEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error: metrics unavailable' }],
    });
  });
});

describe('buildProviderMetricsToolDefinition', () => {
  it('GIVEN no arguments WHEN called THEN returns name "provider_metrics"', () => {
    const toolDefinition = buildProviderMetricsToolDefinition();

    expect(toolDefinition.name).toBe('provider_metrics');
  });

  it('GIVEN no arguments WHEN called THEN description explains real usage feedback', () => {
    const toolDefinition = buildProviderMetricsToolDefinition();

    expect(toolDefinition.description).toContain('actually used');
    expect(toolDefinition.description).toContain('succeeded');
    expect(toolDefinition.description).toContain('took');
  });

  it('GIVEN no arguments WHEN called THEN has readOnly and idempotent annotations', () => {
    const toolDefinition = buildProviderMetricsToolDefinition();

    expect(toolDefinition.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
  });

  it('GIVEN no arguments WHEN called THEN inputSchema is undefined', () => {
    const toolDefinition = buildProviderMetricsToolDefinition();

    expect(toolDefinition.inputSchema).toBeUndefined();
  });
});
