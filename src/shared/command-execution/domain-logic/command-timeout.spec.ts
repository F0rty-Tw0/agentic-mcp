import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAbortSubscription, setupTimeout } from './command-timeout';
import type { StopChild } from '../common';

const stopChildMock = vi.fn<StopChild>();

describe('setupTimeout', () => {
  beforeEach(() => {
    stopChildMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GIVEN timeout not elapsed WHEN markTimedOut called THEN returns false', () => {
    vi.useFakeTimers();
    const handle = setupTimeout(100, stopChildMock);

    expect(handle.markTimedOut()).toBe(false);

    clearTimeout(handle.timer);
  });

  it('GIVEN timeout elapsed WHEN markTimedOut called THEN returns true', async () => {
    vi.useFakeTimers();
    const handle = setupTimeout(100, stopChildMock);

    await vi.advanceTimersByTimeAsync(100);

    expect(handle.markTimedOut()).toBe(true);
  });

  it('GIVEN timeout elapsed with a stop action WHEN timer fires THEN kills the process', async () => {
    vi.useFakeTimers();
    setupTimeout(100, stopChildMock);

    await vi.advanceTimersByTimeAsync(100);

    expect(stopChildMock).toHaveBeenCalledOnce();
  });

  it('GIVEN timeout elapsed without a stop action WHEN timer fires THEN does not kill', async () => {
    vi.useFakeTimers();
    setupTimeout(100);

    await vi.advanceTimersByTimeAsync(100);

    expect(stopChildMock).not.toHaveBeenCalled();
  });
});

describe('createAbortSubscription', () => {
  beforeEach(() => {
    stopChildMock.mockClear();
  });

  it('GIVEN no signal WHEN created THEN returns noop subscription', () => {
    const subscription = createAbortSubscription(undefined, stopChildMock);

    expect(subscription.abortHandler).toBeTypeOf('function');
    expect(subscription.detach).toBeTypeOf('function');
    subscription.detach();
  });

  it('GIVEN no signal and no stop action WHEN abortHandler called THEN does not kill', () => {
    const subscription = createAbortSubscription(undefined, undefined);

    subscription.abortHandler();

    expect(stopChildMock).not.toHaveBeenCalled();
  });

  it('GIVEN signal WHEN abort fires THEN kills the process', () => {
    const controller = new AbortController();

    createAbortSubscription(controller.signal, stopChildMock);

    controller.abort();

    expect(stopChildMock).toHaveBeenCalledOnce();
  });

  it('GIVEN signal WHEN detach called before abort THEN does not kill', () => {
    const controller = new AbortController();
    const subscription = createAbortSubscription(controller.signal, stopChildMock);

    subscription.detach();
    controller.abort();

    expect(stopChildMock).not.toHaveBeenCalled();
  });

  it('GIVEN already aborted signal WHEN created THEN kills immediately', () => {
    const controller = new AbortController();

    controller.abort();

    createAbortSubscription(controller.signal, stopChildMock);

    expect(stopChildMock).toHaveBeenCalledOnce();
  });

  it('GIVEN signal without a stop action WHEN abort fires THEN does not kill', () => {
    const controller = new AbortController();

    createAbortSubscription(controller.signal, undefined);

    controller.abort();

    expect(stopChildMock).not.toHaveBeenCalled();
  });
});
