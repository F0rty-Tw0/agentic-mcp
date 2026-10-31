import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createChildGroupRegistry } from './child-group-registry';
import { CHILD_GROUP_KILL_GRACE_MS } from '../common';

const throwEsrch = (): never => {
  throw new Error('ESRCH');
};

const ignoreSigterm = (): true => true;

type ProcessKill = (target: number, signal?: string | number) => true;

const exitOnSigterm = (): ProcessKill => {
  const received = new Set<string | number | undefined>();

  const kill: ProcessKill = (_target, signal) => {
    received.add(signal);

    const isGone = received.has('SIGTERM');

    if (signal === 0 && isGone) throw new Error('ESRCH');

    return true;
  };

  return kill;
};

describe('FEATURE: child process group registry', () => {
  beforeEach(() => {
    vi.spyOn(process, 'once').mockReturnValue(process);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('GIVEN a tracked child group', () => {
    it('WHEN all groups are terminated THEN the group receives SIGTERM', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(exitOnSigterm());
      const registry = createChildGroupRegistry();

      registry.track(4242);
      await registry.terminateAll();

      expect(killSpy).toHaveBeenCalledWith(-4242, 'SIGTERM');
    });

    it('WHEN the group exits on SIGTERM THEN it never receives SIGKILL', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(exitOnSigterm());
      const registry = createChildGroupRegistry();

      registry.track(4242);
      await registry.terminateAll();

      expect(killSpy).not.toHaveBeenCalledWith(-4242, 'SIGKILL');
    });

    it('WHEN the group ignores SIGTERM past the grace period THEN it receives SIGKILL', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(ignoreSigterm);
      const registry = createChildGroupRegistry();

      registry.track(4242);
      const terminated = registry.terminateAll();

      await vi.advanceTimersByTimeAsync(CHILD_GROUP_KILL_GRACE_MS);
      await terminated;

      expect(killSpy).toHaveBeenCalledWith(-4242, 'SIGKILL');
    });

    it('WHEN the group ignores SIGTERM inside the grace period THEN it has not received SIGKILL yet', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(ignoreSigterm);
      const registry = createChildGroupRegistry();

      registry.track(4242);
      void registry.terminateAll();
      await vi.advanceTimersByTimeAsync(CHILD_GROUP_KILL_GRACE_MS / 2);

      expect(killSpy).not.toHaveBeenCalledWith(-4242, 'SIGKILL');
    });

    it('WHEN the group is already gone THEN terminating it resolves', async () => {
      vi.spyOn(process, 'kill').mockImplementation(throwEsrch);
      const registry = createChildGroupRegistry();

      registry.track(4242);

      await expect(registry.terminateAll()).resolves.toBeUndefined();
    });

    it('WHEN the server exits THEN the sync exit hook sends SIGKILL, since nothing can wait for a grace period there', () => {
      const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
      const registry = createChildGroupRegistry();

      registry.track(4242);
      registry.killAll();

      expect(killSpy).toHaveBeenCalledWith(-4242, 'SIGKILL');
    });

    it('WHEN the group is already gone THEN killing it on exit does not throw', () => {
      vi.spyOn(process, 'kill').mockImplementation(throwEsrch);
      const registry = createChildGroupRegistry();

      registry.track(4242);

      expect(registry.killAll).not.toThrow();
    });

    it('WHEN the first group is tracked THEN one exit hook is installed for the registry', () => {
      const registry = createChildGroupRegistry();

      registry.track(4242);
      registry.track(4343);

      const exitHookCalls = vi.mocked(process.once).mock.calls.filter(([event]) => event === 'exit');

      expect(exitHookCalls).toStrictEqual([['exit', registry.killAll]]);
    });
  });

  describe('GIVEN no other handler for SIGINT, SIGTERM or SIGHUP (CLI mode)', () => {
    it('WHEN the first group is tracked THEN a forwarder is installed for each signal', () => {
      vi.spyOn(process, 'listenerCount').mockReturnValue(0);
      const registry = createChildGroupRegistry();

      registry.track(4242);

      const onceCalls = vi.mocked(process.once).mock.calls;
      const events = onceCalls.map(([event]) => event);
      const signalEvents = events.filter((event) => event !== 'exit');

      expect(signalEvents).toStrictEqual(['SIGINT', 'SIGTERM', 'SIGHUP']);
    });

    it('WHEN the signal arrives THEN the groups are terminated and the signal is re-raised', async () => {
      vi.spyOn(process, 'listenerCount').mockReturnValue(0);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(exitOnSigterm());
      const registry = createChildGroupRegistry();

      registry.track(4242);

      const sigintCall = vi.mocked(process.once).mock.calls.find(([event]) => event === 'SIGINT');
      const forwardSignal = sigintCall?.[1];

      forwardSignal?.('SIGINT');
      await vi.advanceTimersByTimeAsync(CHILD_GROUP_KILL_GRACE_MS);

      expect(killSpy).toHaveBeenCalledWith(-4242, 'SIGTERM');
      expect(killSpy).toHaveBeenLastCalledWith(process.pid, 'SIGINT');
    });

    it('WHEN the signal arrives and the group ignores SIGTERM THEN it gets SIGKILL before the signal is re-raised', async () => {
      vi.spyOn(process, 'listenerCount').mockReturnValue(0);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(ignoreSigterm);
      const registry = createChildGroupRegistry();

      registry.track(4242);

      const sigintCall = vi.mocked(process.once).mock.calls.find(([event]) => event === 'SIGINT');
      const forwardSignal = sigintCall?.[1];

      forwardSignal?.('SIGINT');
      await vi.advanceTimersByTimeAsync(CHILD_GROUP_KILL_GRACE_MS);

      const signals = killSpy.mock.calls.filter(([, signal]) => signal !== 0);

      expect(signals).toStrictEqual([
        [-4242, 'SIGTERM'],
        [-4242, 'SIGKILL'],
        [process.pid, 'SIGINT'],
      ]);
    });
  });

  describe('GIVEN the server already handles the signals (graceful shutdown)', () => {
    it('WHEN a group is tracked THEN no forwarder is installed and the exit hook covers shutdown', () => {
      vi.spyOn(process, 'listenerCount').mockReturnValue(1);
      const registry = createChildGroupRegistry();

      registry.track(4242);

      const events = vi.mocked(process.once).mock.calls.map(([event]) => event);

      expect(events).toStrictEqual(['exit']);
    });
  });

  describe('GIVEN a child group that was untracked after it closed', () => {
    it('WHEN the server exits THEN the group is not signalled', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
      const registry = createChildGroupRegistry();

      const untrack = registry.track(4242);

      untrack();
      await registry.terminateAll();
      registry.killAll();

      expect(killSpy).not.toHaveBeenCalled();
    });
  });
});
