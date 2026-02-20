import { describe, expect, it } from 'vitest';

import { createSemaphore } from './semaphore.ts';

describe('createSemaphore', () => {
  describe('acquireSlot', () => {
    it('GIVEN maxConcurrent is 2 WHEN acquiring 2 slots THEN both resolve immediately', async () => {
      const semaphore = createSemaphore(2);

      let acquired = 0;

      // Both should resolve without blocking
      await semaphore.acquireSlot();
      acquired++;
      await semaphore.acquireSlot();
      acquired++;

      expect(acquired).toBe(2);
    });

    it('GIVEN all slots are taken WHEN acquiring another slot THEN it blocks until a slot is released', async () => {
      const semaphore = createSemaphore(1);

      await semaphore.acquireSlot();

      let resolved = false;
      const pending = semaphore.acquireSlot().then(() => {
        resolved = true;
      });

      // Allow microtasks to flush
      await Promise.resolve();
      expect(resolved).toBe(false);

      semaphore.releaseSlot();
      await pending;

      expect(resolved).toBe(true);
    });
  });

  describe('releaseSlot', () => {
    it('GIVEN a blocked waiter WHEN slot is released THEN the waiter proceeds in FIFO order', async () => {
      const semaphore = createSemaphore(1);
      const order: number[] = [];

      await semaphore.acquireSlot();

      const first = semaphore.acquireSlot().then(() => {
        order.push(1);
      });
      const second = semaphore.acquireSlot().then(() => {
        order.push(2);
      });

      semaphore.releaseSlot();
      await first;

      semaphore.releaseSlot();
      await second;

      expect(order).toStrictEqual([1, 2]);
    });

    it('GIVEN no waiters in queue WHEN slot is released THEN the slot becomes available for future acquire', async () => {
      const semaphore = createSemaphore(1);

      await semaphore.acquireSlot();
      semaphore.releaseSlot();

      // Should resolve immediately — slot is free again
      await semaphore.acquireSlot();
      const reacquired = true;

      expect(reacquired).toBe(true);
    });
  });

  describe('concurrency limit', () => {
    it('GIVEN maxConcurrent is 3 WHEN 5 tasks compete THEN at most 3 run concurrently', async () => {
      const semaphore = createSemaphore(3);
      let running = 0;
      let maxRunning = 0;

      const task = async (): Promise<void> => {
        await semaphore.acquireSlot();

        running++;
        maxRunning = Math.max(maxRunning, running);

        // Simulate async work
        await new Promise<void>((resolve) => setTimeout(resolve, 10));

        running--;
        semaphore.releaseSlot();
      };

      await Promise.all([task(), task(), task(), task(), task()]);

      expect(maxRunning).toBe(3);
    });
  });
});
