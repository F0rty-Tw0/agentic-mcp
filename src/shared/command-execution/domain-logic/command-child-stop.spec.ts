import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupChildStop } from './command-child-stop';
import { killProcess } from './platform';
import type { StoppableChild } from '../common';
import { STDIO_RELEASE_GRACE_MS } from '../common';

vi.mock('./platform', () => {
  const killProcessMock = vi.fn().mockResolvedValue(true);
  const mockedModule = {
    killProcess: killProcessMock,
  };

  return mockedModule;
});

const killProcessMock = vi.mocked(killProcess);

const CHILD_PID = 4321;

type FakeChild = {
  readonly child: StoppableChild;
  readonly emitExit: () => void;
  readonly destroyed: () => boolean;
};

const createFakeChild = (overrides: Partial<StoppableChild> = {}): FakeChild => {
  const emitter = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child: StoppableChild = {
    pid: CHILD_PID,
    on: (event, listener) => emitter.on(event, listener),
    stdout,
    stderr,
    ...overrides,
  };

  const fakeChild: FakeChild = {
    child,
    emitExit: () => emitter.emit('exit'),
    destroyed: () => stdout.destroyed && stderr.destroyed,
  };

  return fakeChild;
};

describe('FEATURE: stop a child and release its stdio', () => {
  beforeEach(() => {
    killProcessMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN a child with a pid', () => {
    it('WHEN a stop is requested THEN the child is killed', () => {
      const fake = createFakeChild();
      const childStop = setupChildStop(fake.child);

      childStop.stop?.();

      expect(killProcessMock).toHaveBeenCalledWith(CHILD_PID, { childExited: false });
    });

    it('WHEN a stop is requested after the child exited THEN the kill knows the child exited', () => {
      const fake = createFakeChild();
      const childStop = setupChildStop(fake.child);

      fake.emitExit();
      childStop.stop?.();

      expect(killProcessMock).toHaveBeenCalledWith(CHILD_PID, { childExited: true });
    });
  });

  describe('GIVEN a stop was requested before the child exited', () => {
    it('WHEN the child exits and the grace period passes THEN stdout and stderr are destroyed', () => {
      const fake = createFakeChild();
      const childStop = setupChildStop(fake.child);

      childStop.stop?.();
      fake.emitExit();
      vi.advanceTimersByTime(STDIO_RELEASE_GRACE_MS);

      expect(fake.destroyed()).toBe(true);
    });

    it('WHEN the release is cancelled before the grace period ends THEN stdio stays open', () => {
      const fake = createFakeChild();
      const childStop = setupChildStop(fake.child);

      childStop.stop?.();
      fake.emitExit();
      childStop.cancelRelease();
      vi.advanceTimersByTime(STDIO_RELEASE_GRACE_MS);

      expect(fake.destroyed()).toBe(false);
    });
  });

  describe('GIVEN a child that exited on its own', () => {
    it('WHEN no stop is requested THEN stdio stays open for descendants still writing', () => {
      const fake = createFakeChild();

      setupChildStop(fake.child);
      fake.emitExit();
      vi.advanceTimersByTime(STDIO_RELEASE_GRACE_MS);

      expect(fake.destroyed()).toBe(false);
    });

    it('WHEN a stop is requested and the grace period passes THEN stdout and stderr are destroyed', () => {
      const fake = createFakeChild();
      const childStop = setupChildStop(fake.child);

      fake.emitExit();
      childStop.stop?.();
      vi.advanceTimersByTime(STDIO_RELEASE_GRACE_MS);

      expect(fake.destroyed()).toBe(true);
    });

    it('WHEN a stop is requested and the grace period has not passed THEN stdio stays open', () => {
      const fake = createFakeChild();
      const childStop = setupChildStop(fake.child);

      fake.emitExit();
      childStop.stop?.();
      vi.advanceTimersByTime(STDIO_RELEASE_GRACE_MS - 1);

      expect(fake.destroyed()).toBe(false);
    });
  });

  it('GIVEN a child without a pid WHEN set up THEN there is no stop action', () => {
    const fake = createFakeChild({ pid: undefined });

    const childStop = setupChildStop(fake.child);

    expect(childStop.stop).toBeUndefined();
  });
});

describe('FEATURE: track whether a child exited before a stop was requested', () => {
  it('GIVEN no stop was requested WHEN the child exits THEN it exited before the stop', () => {
    const fake = createFakeChild();
    const childStop = setupChildStop(fake.child);

    fake.emitExit();

    expect(childStop.exitedBeforeStop()).toBe(true);
  });

  it('GIVEN a stop was requested WHEN the child exits THEN it did not exit before the stop', () => {
    const fake = createFakeChild();
    const childStop = setupChildStop(fake.child);

    childStop.stop?.();
    fake.emitExit();

    expect(childStop.exitedBeforeStop()).toBe(false);
  });

  it('GIVEN a child that has not exited WHEN asked THEN it did not exit before the stop', () => {
    const fake = createFakeChild();

    const childStop = setupChildStop(fake.child);

    expect(childStop.exitedBeforeStop()).toBe(false);
  });
});
