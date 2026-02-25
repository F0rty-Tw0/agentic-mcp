import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProviderMetricsSummary } from '../common';
import { MAX_METRIC_RECORDS } from '../common';

describe('provider-metrics-store', () => {
  let recordCall: (provider: string, executionTimeMs: number, success: boolean) => void;
  let getProviderMetrics: () => ProviderMetricsSummary;

  beforeEach(async () => {
    vi.resetModules();
    ({ recordCall, getProviderMetrics } = await import('./provider-metrics-store'));
  });

  describe('recordCall', () => {
    it('GIVEN a provider call WHEN recorded THEN getProviderMetrics includes that provider', () => {
      recordCall('claude', 500, true);

      const summary = getProviderMetrics();

      expect(summary.providers).toHaveLength(1);
      expect(summary.providers[0]?.provider).toBe('claude');
    });

    it('GIVEN a successful call WHEN recorded THEN successCount is 1 and failureCount is 0', () => {
      recordCall('claude', 100, true);

      const summary = getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.successCount).toBe(1);
      expect(stats?.failureCount).toBe(0);
    });

    it('GIVEN a failed call WHEN recorded THEN failureCount is 1 and successCount is 0', () => {
      recordCall('claude', 100, false);

      const summary = getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.successCount).toBe(0);
      expect(stats?.failureCount).toBe(1);
    });

    it('GIVEN multiple calls WHEN recorded THEN totalCalls reflects count', () => {
      recordCall('claude', 100, true);
      recordCall('claude', 200, true);
      recordCall('claude', 300, false);

      const summary = getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.totalCalls).toBe(3);
    });
  });

  describe('getProviderMetrics', () => {
    it('GIVEN no calls WHEN queried THEN returns empty providers and totalCalls 0', () => {
      const summary = getProviderMetrics();

      expect(summary.totalCalls).toBe(0);
      expect(summary.providers).toHaveLength(0);
    });

    it('GIVEN one call WHEN queried THEN totalCalls is 1', () => {
      recordCall('claude', 100, true);

      const summary = getProviderMetrics();

      expect(summary.totalCalls).toBe(1);
    });

    it('GIVEN calls to two providers WHEN queried THEN returns stats for both', () => {
      recordCall('claude', 100, true);
      recordCall('codex', 200, false);

      const summary = getProviderMetrics();

      expect(summary.providers).toHaveLength(2);
      expect(summary.totalCalls).toBe(2);

      const providers = summary.providers.map((p) => p.provider);

      expect(providers).toContain('claude');
      expect(providers).toContain('codex');
    });

    it('GIVEN multiple calls WHEN queried THEN avgExecutionTimeMs is correct', () => {
      recordCall('claude', 100, true);
      recordCall('claude', 300, true);

      const summary = getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.totalExecutionTimeMs).toBe(400);
      expect(stats?.avgExecutionTimeMs).toBe(200);
    });

    it('GIVEN a call WHEN queried THEN lastCallAt is a valid ISO string', () => {
      recordCall('claude', 100, true);

      const summary = getProviderMetrics();
      const stats = summary.providers[0];

      expect(stats?.lastCallAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('GIVEN session start WHEN queried THEN sessionStartedAt is a valid ISO string', () => {
      const summary = getProviderMetrics();

      expect(summary.sessionStartedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('MAX_METRIC_RECORDS pruning', () => {
    it('GIVEN more than MAX_METRIC_RECORDS calls WHEN recorded THEN store does not exceed limit', () => {
      for (let i = 0; i < MAX_METRIC_RECORDS + 10; i++) {
        recordCall('claude', 10, true);
      }

      const summary = getProviderMetrics();

      expect(summary.totalCalls).toBeLessThanOrEqual(MAX_METRIC_RECORDS);
    });
  });
});
