import { afterEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../validation/common';

import { retryWithExponentialBackoff } from '.';

describe('retryWithExponentialBackoff', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('GIVEN successful operation WHEN called THEN returns value without retries', async () => {
    const operation = vi.fn<() => Promise<string>>().mockResolvedValue('ok');

    const result = await retryWithExponentialBackoff({
      operation,
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 100,
    });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('GIVEN transient failures WHEN retries succeed THEN uses exponential delays', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValueOnce('ok');
    const retryPromise = retryWithExponentialBackoff({
      operation,
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 100,
    });

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    const result = await retryPromise;

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 10);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 20);
  });

  it('GIVEN retries exceed max WHEN operation keeps failing THEN throws the original error', async () => {
    vi.useFakeTimers();
    const rootError = new Error('persistent');
    const operation = vi.fn(async (): Promise<string> => Promise.reject(rootError));
    const retryPromise = retryWithExponentialBackoff({
      operation,
      maxRetries: 2,
      initialDelayMs: 10,
      maxDelayMs: 15,
    });
    const caughtErrorPromise = retryPromise.catch((error: unknown) => error);

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    const caughtError = await caughtErrorPromise;

    expect(caughtError).toBe(rootError);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('GIVEN max delay cap WHEN computing delays THEN does not exceed max delay', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const operation = vi.fn(async (): Promise<string> => Promise.reject(new Error('fail')));
    const retryPromise = retryWithExponentialBackoff({
      operation,
      maxRetries: 3,
      initialDelayMs: 50,
      maxDelayMs: 60,
    });
    const caughtErrorPromise = retryPromise.catch((error: unknown) => error);

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    const caughtError = await caughtErrorPromise;

    expect(caughtError).toBeInstanceOf(Error);

    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 50);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 60);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(3, expect.any(Function), 60);
  });

  it('GIVEN invalid retry settings WHEN called THEN throws validation error', async () => {
    const operation = vi.fn<() => Promise<string>>().mockResolvedValue('ok');

    const caughtError = await retryWithExponentialBackoff({
      operation,
      maxRetries: -1,
      initialDelayMs: 10,
      maxDelayMs: 100,
    }).catch((error: unknown) => error);

    expect(caughtError).toBeInstanceOf(ValidationError);
  });
});
