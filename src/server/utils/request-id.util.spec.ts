import { describe, expect, it } from 'vitest';

import { toRequestIdString } from './request-id.util';

describe('toRequestIdString', () => {
  it('GIVEN string request ID WHEN converted THEN returns the same string', () => {
    const result = toRequestIdString('abc-123');

    expect(result).toBe('abc-123');
  });

  it('GIVEN numeric request ID WHEN converted THEN returns stringified number', () => {
    const result = toRequestIdString(42);

    expect(result).toBe('42');
  });

  it('GIVEN zero WHEN converted THEN returns undefined', () => {
    const result = toRequestIdString(0);

    expect(result).toBeUndefined();
  });

  it('GIVEN undefined WHEN converted THEN returns undefined', () => {
    const result = toRequestIdString(undefined);

    expect(result).toBeUndefined();
  });

  it('GIVEN empty string WHEN converted THEN returns undefined', () => {
    const result = toRequestIdString('');

    expect(result).toBeUndefined();
  });
});
