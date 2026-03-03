import { afterEach, describe, expect, it, vi } from 'vitest';

import { nowIso } from './date-time.util';

describe('nowIso', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN current time WHEN called THEN returns a valid ISO 8601 string', () => {
    const result = nowIso();

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('GIVEN a fixed system time WHEN called THEN returns the expected ISO string', () => {
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-06-15T12:00:00.000Z');

    expect(nowIso()).toBe('2026-06-15T12:00:00.000Z');
  });

  it('GIVEN two consecutive calls WHEN called THEN both return strings (no side effects)', () => {
    const first = nowIso();
    const second = nowIso();

    expect(typeof first).toBe('string');
    expect(typeof second).toBe('string');
  });
});
