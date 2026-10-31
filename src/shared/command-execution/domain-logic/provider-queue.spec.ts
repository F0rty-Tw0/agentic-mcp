import { describe, expect, it, vi } from 'vitest';

import type { ProviderQueueOptions } from '../common';
import { GLOBAL_SLOT_MAX_EXTRA_WAIT_MS } from '../common';
import { createProviderQueueStore } from './provider-queue';
import { QueueTimeoutError } from '../common/errors';
import type { ProviderQueueLease } from '../common/provider-queue.type';

const createQueueInput = (overrides: Partial<ProviderQueueOptions> = {}): ProviderQueueOptions => {
  const providerQueueOptions: ProviderQueueOptions = {
    providerName: 'codex',
    maxConcurrency: 1,
    queueTimeoutMs: 50,
    ...overrides,
  };

  return providerQueueOptions;
};

const trackSettlement = (promise: Promise<ProviderQueueLease>): (() => string) => {
  let state = 'pending';
  const onAcquired = (lease: ProviderQueueLease): void => {
    state = 'acquired';
    lease.release();
  };
  const onRejected = (error: unknown): void => {
    state = String(error);
  };
  const readState = (): string => state;

  void promise.then(onAcquired, onRejected);

  return readState;
};

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

  it('GIVEN the global ceiling is full and the provider itself is idle WHEN the request waits past queueTimeoutMs THEN it keeps waiting and gets the next global slot', async () => {
    vi.useFakeTimers();

    const store = createProviderQueueStore({ globalMaxConcurrency: 1 });
    const busyLease = await store.acquireSlot(createQueueInput({ providerName: 'a' }));
    const waitingPromise = store.acquireSlot(createQueueInput({ providerName: 'b' }));
    const settledPromise = waitingPromise.then(() => 'acquired').catch((value: unknown) => value);

    await vi.advanceTimersByTimeAsync(500);
    busyLease.release();

    const settled = await settledPromise;

    expect(settled).toBe('acquired');
    vi.useRealTimers();
  });

  it('GIVEN the provider is busy and the global ceiling is also full WHEN the request waits past queueTimeoutMs THEN it rejects with QueueTimeoutError', async () => {
    vi.useFakeTimers();

    const store = createProviderQueueStore({ globalMaxConcurrency: 2 });
    const providerLease = await store.acquireSlot(createQueueInput());
    const otherLease = await store.acquireSlot(createQueueInput({ providerName: 'a' }));
    const caughtPromise = store.acquireSlot(createQueueInput()).catch((value: unknown) => value);

    await vi.advanceTimersByTimeAsync(51);

    const error = await caughtPromise;

    expect(error).toBeInstanceOf(QueueTimeoutError);
    providerLease.release();
    otherLease.release();
    vi.useRealTimers();
  });
  it('GIVEN a global ceiling of one and a provider that queues its next call before each release WHEN another provider waits THEN the older waiter gets the freed slot', async () => {
    vi.useFakeTimers();

    const store = createProviderQueueStore({ globalMaxConcurrency: 1 });
    const busyInput = createQueueInput({ providerName: 'a', queueTimeoutMs: 1_000 });
    let busyLease = await store.acquireSlot(busyInput);
    const readSettlement = trackSettlement(store.acquireSlot(createQueueInput({ providerName: 'b' })));

    for (let turn = 0; turn < 20; turn++) {
      const nextBusyLease = store.acquireSlot(busyInput);

      await vi.advanceTimersByTimeAsync(80);
      busyLease.release();
      busyLease = await nextBusyLease;
    }

    expect(readSettlement()).toBe('acquired');
    busyLease.release();
    vi.useRealTimers();
  });
  it('GIVEN the global ceiling stays full and the provider itself is idle WHEN the request waits past queueTimeoutMs plus the extra global wait THEN it rejects with QueueTimeoutError', async () => {
    vi.useFakeTimers();

    const store = createProviderQueueStore({ globalMaxConcurrency: 1 });
    const busyLease = await store.acquireSlot(createQueueInput({ providerName: 'a' }));
    const waitingInput = createQueueInput({ providerName: 'b', queueTimeoutMs: 600_000 });
    const readSettlement = trackSettlement(store.acquireSlot(waitingInput));
    const maxWaitMs = waitingInput.queueTimeoutMs + GLOBAL_SLOT_MAX_EXTRA_WAIT_MS;

    await vi.advanceTimersByTimeAsync(maxWaitMs - 1);

    expect(readSettlement()).toBe('pending');

    await vi.advanceTimersByTimeAsync(1);

    expect(readSettlement()).toMatch(/^QueueTimeoutError: Queue timeout for provider "b"/);
    busyLease.release();
    vi.useRealTimers();
  });
  it('GIVEN the global ceiling stays full and the provider itself is idle WHEN the request times out THEN the error names the full wait limit', async () => {
    vi.useFakeTimers();

    const store = createProviderQueueStore({ globalMaxConcurrency: 1 });
    const busyLease = await store.acquireSlot(createQueueInput({ providerName: 'a' }));
    const waitingInput = createQueueInput({ providerName: 'b', queueTimeoutMs: 600_000 });
    const readSettlement = trackSettlement(store.acquireSlot(waitingInput));

    await vi.advanceTimersByTimeAsync(waitingInput.queueTimeoutMs + GLOBAL_SLOT_MAX_EXTRA_WAIT_MS);

    expect(readSettlement()).toContain('waited 4200 s for a free slot (limit: 4200 s)');
    busyLease.release();
    vi.useRealTimers();
  });
  it('GIVEN an already aborted signal and a free slot WHEN acquiring THEN it rejects instead of granting the slot', async () => {
    const store = createProviderQueueStore();
    const controller = new AbortController();

    controller.abort();

    const readSettlement = trackSettlement(store.acquireSlot(createQueueInput({ signal: controller.signal })));

    await Promise.resolve();

    expect(readSettlement()).toBe('CommandExecutionError: Command cancelled while waiting for provider queue slot');
  });
});
