type Semaphore = { readonly acquireSlot: () => Promise<void>; readonly releaseSlot: () => void };

export const createSemaphore = (maxConcurrent: number): Semaphore => {
  let activeCount = 0;
  const waitQueue: Array<() => void> = [];

  const acquireSlot = async (): Promise<void> => {
    if (activeCount < maxConcurrent) {
      activeCount++;

      return;
    }

    return new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
  };

  const releaseSlot = (): void => {
    activeCount--;
    const next = waitQueue.shift();

    if (next) {
      activeCount++;
      next();
    }
  };

  const semaphore: Semaphore = { acquireSlot, releaseSlot };

  return semaphore;
};
