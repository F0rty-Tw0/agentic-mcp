import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleUsageSummary } from './usage-stats.handler.ts';
import { getUsageSummary } from '../data-access/usage-stats-store.ts';

vi.mock('../data-access/usage-stats-store.ts', () => ({
  getUsageSummary: vi.fn(),
}));

describe('handleUsageSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN a usage summary WHEN called THEN returns it as JSON text content', () => {
    const fakeSummary = {
      sessionStartedAt: '2026-01-01T00:00:00.000Z',
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

    vi.mocked(getUsageSummary).mockReturnValue(fakeSummary);

    const result = handleUsageSummary();

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toStrictEqual({
      type: 'text',
      text: JSON.stringify(fakeSummary, null, 2),
    });
  });

  it('GIVEN usage summary WHEN called THEN delegates to getUsageSummary', () => {
    vi.mocked(getUsageSummary).mockReturnValue({
      sessionStartedAt: '2026-01-01T00:00:00.000Z',
      totalCalls: 0,
      providers: [],
    });

    handleUsageSummary();

    expect(getUsageSummary).toHaveBeenCalledOnce();
  });
});
