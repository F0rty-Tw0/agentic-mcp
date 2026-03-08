import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { killProcess } from '../utils';
import { createAbortSubscription, setupTimeout } from './command-timeout.util';

vi.mock('../utils', () => ({
  killProcess: vi.fn().mockResolvedValue(undefined),
}));

const killProcessMock = vi.mocked(killProcess);

describe('setupTimeout', () => {
  beforeEach(() => {
    killProcessMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GIVEN timeout not elapsed WHEN markTimedOut called THEN returns false', () => {
    vi.useFakeTimers();
    const handle = setupTimeout(100, 1234);

    expect(handle.markTimedOut()).toBe(false);

    clearTimeout(handle.timer);
  });

  it('GIVEN timeout elapsed WHEN markTimedOut called THEN returns true', async () => {
    vi.useFakeTimers();
    const handle = setupTimeout(100, 1234);

    await vi.advanceTimersByTimeAsync(100);

    expect(handle.markTimedOut()).toBe(true);
  });

  it('GIVEN timeout elapsed with pid WHEN timer fires THEN kills the process', async () => {
    vi.useFakeTimers();
    setupTimeout(100, 9999);

    await vi.advanceTimersByTimeAsync(100);

    expect(killProcessMock).toHaveBeenCalledWith(9999);
  });

  it('GIVEN timeout elapsed without pid WHEN timer fires THEN does not kill', async () => {
    vi.useFakeTimers();
    setupTimeout(100);

    await vi.advanceTimersByTimeAsync(100);

    expect(killProcessMock).not.toHaveBeenCalled();
  });
});

describe('createAbortSubscription', () => {
  beforeEach(() => {
    killProcessMock.mockClear();
  });

  it('GIVEN no signal WHEN created THEN returns noop subscription', () => {
    const subscription = createAbortSubscription(undefined, 1234);

    expect(subscription.abortHandler).toBeTypeOf('function');
    expect(subscription.detach).toBeTypeOf('function');
    subscription.detach();
  });

  it('GIVEN no signal and no pid WHEN abortHandler called THEN does not kill', () => {
    const subscription = createAbortSubscription(undefined, undefined);

    subscription.abortHandler();

    expect(killProcessMock).not.toHaveBeenCalled();
  });

  it('GIVEN signal WHEN abort fires THEN kills the process', () => {
    const controller = new AbortController();

    createAbortSubscription(controller.signal, 9999);

    controller.abort();

    expect(killProcessMock).toHaveBeenCalledWith(9999);
  });

  it('GIVEN signal WHEN detach called before abort THEN does not kill', () => {
    const controller = new AbortController();
    const subscription = createAbortSubscription(controller.signal, 9999);

    subscription.detach();
    controller.abort();

    expect(killProcessMock).not.toHaveBeenCalled();
  });

  it('GIVEN already aborted signal WHEN created THEN kills immediately', () => {
    const controller = new AbortController();

    controller.abort();

    createAbortSubscription(controller.signal, 9999);

    expect(killProcessMock).toHaveBeenCalledWith(9999);
  });

  it('GIVEN signal without pid WHEN abort fires THEN does not kill', () => {
    const controller = new AbortController();

    createAbortSubscription(controller.signal, undefined);

    controller.abort();

    expect(killProcessMock).not.toHaveBeenCalled();
  });
});
