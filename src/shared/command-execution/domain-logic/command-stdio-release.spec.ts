import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { releaseStdioAfterKilledExit } from './command-stdio-release';
import type { StdioReleasableChild } from '../common';
import { STDIO_RELEASE_GRACE_MS } from '../common';

type FakeChild = {
  readonly child: StdioReleasableChild;
  readonly emitExit: () => void;
  readonly destroyed: () => boolean;
};

const createFakeChild = (): FakeChild => {
  const emitter = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child: StdioReleasableChild = {
    on: (event, listener) => emitter.on(event, listener),
    stdout,
    stderr,
  };

  const fakeChild: FakeChild = {
    child,
    emitExit: () => emitter.emit('exit'),
    destroyed: () => stdout.destroyed && stderr.destroyed,
  };

  return fakeChild;
};

describe('FEATURE: release stdio after a killed child exits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN a kill was requested', () => {
    it('WHEN the child exits and the grace period passes THEN stdout and stderr are destroyed', () => {
      const fake = createFakeChild();

      releaseStdioAfterKilledExit(fake.child, () => true);
      fake.emitExit();
      vi.advanceTimersByTime(STDIO_RELEASE_GRACE_MS);

      expect(fake.destroyed()).toBe(true);
    });

    it('WHEN the release is cancelled before the grace period ends THEN stdio stays open', () => {
      const fake = createFakeChild();

      const cancel = releaseStdioAfterKilledExit(fake.child, () => true);

      fake.emitExit();
      cancel();
      vi.advanceTimersByTime(STDIO_RELEASE_GRACE_MS);

      expect(fake.destroyed()).toBe(false);
    });
  });

  describe('GIVEN no kill was requested', () => {
    it('WHEN the child exits on its own THEN stdio stays open for descendants still writing', () => {
      const fake = createFakeChild();

      releaseStdioAfterKilledExit(fake.child, () => false);
      fake.emitExit();
      vi.advanceTimersByTime(STDIO_RELEASE_GRACE_MS);

      expect(fake.destroyed()).toBe(false);
    });
  });
});
