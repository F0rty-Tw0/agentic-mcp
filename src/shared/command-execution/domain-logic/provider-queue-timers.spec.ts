import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderQueueOptions } from '../common';
import { GLOBAL_SLOT_MAX_EXTRA_WAIT_MS } from '../common';
import { createProviderQueueStore } from './provider-queue';

const createQueueInput = (overrides: Partial<ProviderQueueOptions> = {}): ProviderQueueOptions => {
  const providerQueueOptions: ProviderQueueOptions = {
    providerName: 'codex',
    maxConcurrency: 1,
    queueTimeoutMs: 50,
    ...overrides,
  };

  return providerQueueOptions;
};

describe('FEATURE: provider queue timers are cleared on every exit path', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN a request re-armed while only the global ceiling blocks it', () => {
    it('WHEN the caller aborts THEN no queue timer is left behind', async () => {
      vi.useFakeTimers();
      const store = createProviderQueueStore({ globalMaxConcurrency: 1 });
      const busyLease = await store.acquireSlot(createQueueInput({ providerName: 'a' }));
      const controller = new AbortController();
      const waiting = store.acquireSlot(createQueueInput({ providerName: 'b', signal: controller.signal }));
      const settled = waiting.catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(120);
      controller.abort();
      await settled;

      expect(vi.getTimerCount()).toBe(0);
      busyLease.release();
    });

    it('WHEN a global slot frees THEN the started request leaves no queue timer behind', async () => {
      vi.useFakeTimers();
      const store = createProviderQueueStore({ globalMaxConcurrency: 1 });
      const busyLease = await store.acquireSlot(createQueueInput({ providerName: 'a' }));
      const waiting = store.acquireSlot(createQueueInput({ providerName: 'b' }));

      await vi.advanceTimersByTimeAsync(120);
      busyLease.release();
      const lease = await waiting;

      expect(vi.getTimerCount()).toBe(0);
      lease.release();
    });

    it('WHEN the full wait limit passes THEN the rejected request leaves no queue timer behind', async () => {
      vi.useFakeTimers();
      const store = createProviderQueueStore({ globalMaxConcurrency: 1 });
      const busyLease = await store.acquireSlot(createQueueInput({ providerName: 'a' }));
      const settled = store.acquireSlot(createQueueInput({ providerName: 'b' })).catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(50 + GLOBAL_SLOT_MAX_EXTRA_WAIT_MS + 100);
      await settled;

      expect(vi.getTimerCount()).toBe(0);
      busyLease.release();
    });
  });
});
