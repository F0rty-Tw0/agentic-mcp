import { afterEach, describe, expect, it } from 'vitest';

import { getActiveRequest, registerActiveRequest, unregisterActiveRequest } from './request-registry';

describe('requestRegistry', () => {
  afterEach(() => {
    unregisterActiveRequest('req-1');
    unregisterActiveRequest('req-2');
  });

  describe('registerActiveRequest', () => {
    it('GIVEN a requestId and pid WHEN registered THEN getActiveRequest returns the entry', () => {
      registerActiveRequest('req-1', 1234);

      expect(getActiveRequest('req-1')).toStrictEqual({ requestId: 'req-1', pid: 1234 });
    });

    it('GIVEN an existing requestId WHEN registered again THEN the entry is overwritten', () => {
      registerActiveRequest('req-1', 1234);
      registerActiveRequest('req-1', 5678);

      expect(getActiveRequest('req-1')).toStrictEqual({ requestId: 'req-1', pid: 5678 });
    });
  });

  describe('unregisterActiveRequest', () => {
    it('GIVEN a registered requestId WHEN unregistered THEN getActiveRequest returns undefined', () => {
      registerActiveRequest('req-1', 1234);

      unregisterActiveRequest('req-1');

      expect(getActiveRequest('req-1')).toBeUndefined();
    });

    it('GIVEN an unregistered requestId WHEN unregistered THEN no error is thrown', () => {
      expect(() => unregisterActiveRequest('nonexistent')).not.toThrow();
    });
  });

  describe('getActiveRequest', () => {
    it('GIVEN no registered requests WHEN queried THEN returns undefined', () => {
      expect(getActiveRequest('req-1')).toBeUndefined();
    });

    it('GIVEN multiple registered requests WHEN queried THEN returns only the matching entry', () => {
      registerActiveRequest('req-1', 1111);
      registerActiveRequest('req-2', 2222);

      expect(getActiveRequest('req-1')).toStrictEqual({ requestId: 'req-1', pid: 1111 });
      expect(getActiveRequest('req-2')).toStrictEqual({ requestId: 'req-2', pid: 2222 });
    });
  });
});
