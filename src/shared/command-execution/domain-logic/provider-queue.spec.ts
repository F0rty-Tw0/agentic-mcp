import { describe, expect, it, vi } from 'vitest';

import type { ProviderQueueOptions } from '../common';
import { createProviderQueueStore } from './provider-queue';
import { QueueTimeoutError } from '../common/errors';

const createQueueInput = (overrides: Partial<ProviderQueueOptions> = {}): ProviderQueueOptions => ({
  providerName: 'codex',
  maxConcurrency: 1,
  queueTimeoutMs: 50,
  ...overrides,
});

describe('createProviderQueueStore', () => {
  it('GIVEN maxConcurrency 1 WHEN two requests share a provider THEN the second waits for the first', async () => {
    const store = createProviderQueueStore();
    const first = await store.acquireSlot(createQueueInput());
    let secondAcquired = false;
    const secondPromise = store.acquireSlot(createQueueInput()).then((slot) => {
      secondAcquired = true;

      return slot;
    });

    await Promise.resolve();

    expect(secondAcquired).toBe(false);

    first.release();

    const second = await secondPromise;

    expect(secondAcquired).toBe(true);
    second.release();
  });

  it('GIVEN maxConcurrency 3 WHEN four requests share a provider THEN the fourth waits until one releases', async () => {
    const store = createProviderQueueStore();
    const input = createQueueInput({ maxConcurrency: 3 });
    const first = await store.acquireSlot(input);
    const second = await store.acquireSlot(input);
    const third = await store.acquireSlot(input);
    let fourthAcquired = false;
    const fourthPromise = store.acquireSlot(input).then((slot) => {
      fourthAcquired = true;

      return slot;
    });

    await Promise.resolve();

    expect(fourthAcquired).toBe(false);

    first.release();

    const fourth = await fourthPromise;

    expect(fourthAcquired).toBe(true);
    second.release();
    third.release();
    fourth.release();
  });

  it('GIVEN a queued request WHEN it waits past queueTimeoutMs THEN it rejects with QueueTimeoutError', async () => {
    vi.useFakeTimers();

    const store = createProviderQueueStore();
    const first = await store.acquireSlot(createQueueInput());
    const secondPromise = store.acquireSlot(createQueueInput());
    const caughtSecondPromise = secondPromise.catch((value: unknown) => value);

    await vi.advanceTimersByTimeAsync(51);

    const error = await caughtSecondPromise;

    expect(error).toBeInstanceOf(QueueTimeoutError);

    first.release();
    vi.useRealTimers();
  });

  it('GIVEN six providers WHEN global ceiling is five THEN the sixth waits until a global slot opens', async () => {
    const store = createProviderQueueStore({ globalMaxConcurrency: 5 });
    const leaseA = await store.acquireSlot(createQueueInput({ providerName: 'a' }));
    const leaseB = await store.acquireSlot(createQueueInput({ providerName: 'b' }));
    const leaseC = await store.acquireSlot(createQueueInput({ providerName: 'c' }));
    const leaseD = await store.acquireSlot(createQueueInput({ providerName: 'd' }));
    const leaseE = await store.acquireSlot(createQueueInput({ providerName: 'e' }));
    let sixthAcquired = false;
    const sixthPromise = store.acquireSlot(createQueueInput({ providerName: 'f' })).then((slot) => {
      sixthAcquired = true;

      return slot;
    });

    await Promise.resolve();

    expect(sixthAcquired).toBe(false);

    leaseA.release();

    const sixth = await sixthPromise;

    expect(sixthAcquired).toBe(true);
    leaseB.release();
    leaseC.release();
    leaseD.release();
    leaseE.release();
    sixth.release();
  });
});
