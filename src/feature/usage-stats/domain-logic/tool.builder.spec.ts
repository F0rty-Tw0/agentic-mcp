import { describe, expect, it } from 'vitest';

import { buildUsageSummaryToolDefinition } from './tool.builder.ts';

describe('buildUsageSummaryToolDefinition', () => {
  it('GIVEN no arguments WHEN called THEN returns name "usage_summary"', () => {
    const def = buildUsageSummaryToolDefinition();

    expect(def.name).toBe('usage_summary');
  });

  it('GIVEN no arguments WHEN called THEN description mentions provider and session', () => {
    const def = buildUsageSummaryToolDefinition();

    expect(def.description).toContain('provider');
    expect(def.description.length).toBeGreaterThan(10);
  });

  it('GIVEN no arguments WHEN called THEN has readOnly and idempotent annotations', () => {
    const def = buildUsageSummaryToolDefinition();

    expect(def.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
  });

  it('GIVEN no arguments WHEN called THEN inputSchema is empty object', () => {
    const def = buildUsageSummaryToolDefinition();

    expect(def.inputSchema).toStrictEqual({});
  });
});
