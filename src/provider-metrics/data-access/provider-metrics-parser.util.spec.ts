import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEmptyProviderMetricsFile, parseProviderMetricsFile } from './provider-metrics-parser.util';
import { ValidationError } from '../../shared';

afterEach(() => {
  vi.useRealTimers();
});

describe('createEmptyProviderMetricsFile', () => {
  it('GIVEN current time WHEN creating an empty metrics file THEN returns timestamp and no records', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));

    const result = createEmptyProviderMetricsFile();

    expect(result).toStrictEqual({
      collectedSince: '2026-01-02T03:04:05.000Z',
      records: [],
    });
  });
});

describe('parseProviderMetricsFile', () => {
  it('GIVEN valid persisted metrics JSON WHEN parsed THEN returns the stored metrics file', () => {
    const content = JSON.stringify({
      collectedSince: '2026-01-01T00:00:00.000Z',
      records: [
        {
          provider: 'claude',
          executionTimeMs: 123,
          success: true,
          calledAt: '2026-01-01T00:01:00.000Z',
        },
      ],
    });

    const result = parseProviderMetricsFile(content);

    expect(result).toStrictEqual({
      collectedSince: '2026-01-01T00:00:00.000Z',
      records: [
        {
          provider: 'claude',
          executionTimeMs: 123,
          success: true,
          calledAt: '2026-01-01T00:01:00.000Z',
        },
      ],
    });
  });

  it('GIVEN invalid JSON WHEN parsed THEN throws a ValidationError with parse details', () => {
    const parseContent = (): void => {
      parseProviderMetricsFile('{"records":[]}garbage');
    };

    expect(parseContent).toThrowError(ValidationError);
    expect(parseContent).toThrowError(/Stored provider metrics are invalid JSON:/);
  });

  it('GIVEN a non-object root WHEN parsed THEN throws a ValidationError', () => {
    const parseContent = (): void => {
      parseProviderMetricsFile('[]');
    };

    expect(parseContent).toThrowError(ValidationError);
    expect(parseContent).toThrowError('Stored provider metrics root must be an object.');
  });

  it('GIVEN missing collectedSince WHEN parsed THEN throws a ValidationError', () => {
    const parseContent = (): void => {
      parseProviderMetricsFile(JSON.stringify({ records: [] }));
    };

    expect(parseContent).toThrowError(ValidationError);
    expect(parseContent).toThrowError('Stored provider metrics must include string key "collectedSince".');
  });

  it('GIVEN missing records WHEN parsed THEN throws a ValidationError', () => {
    const parseContent = (): void => {
      parseProviderMetricsFile(JSON.stringify({ collectedSince: '2026-01-01T00:00:00.000Z' }));
    };

    expect(parseContent).toThrowError(ValidationError);
    expect(parseContent).toThrowError('Stored provider metrics must include array key "records".');
  });

  it('GIVEN an invalid stored record WHEN parsed THEN throws a ValidationError', () => {
    const parseContent = (): void => {
      parseProviderMetricsFile(
        JSON.stringify({
          collectedSince: '2026-01-01T00:00:00.000Z',
          records: [
            { provider: 'claude', executionTimeMs: 'slow', success: true, calledAt: '2026-01-01T00:01:00.000Z' },
          ],
        })
      );
    };

    expect(parseContent).toThrowError(ValidationError);
    expect(parseContent).toThrowError('Stored provider metrics records are invalid.');
  });
});
