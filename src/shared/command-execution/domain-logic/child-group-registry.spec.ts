import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createChildGroupRegistry } from './child-group-registry';

const throwEsrch = (): never => {
  throw new Error('ESRCH');
};

describe('FEATURE: child process group registry', () => {
  beforeEach(() => {
    vi.spyOn(process, 'once').mockReturnValue(process);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GIVEN a tracked child group', () => {
    it('WHEN the server exits THEN the group receives SIGTERM', () => {
      const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
      const registry = createChildGroupRegistry();

      registry.track(4242);
      registry.terminateAll();

      expect(killSpy).toHaveBeenCalledWith(-4242, 'SIGTERM');
    });

    it('WHEN the group is already gone THEN terminating it does not throw', () => {
      vi.spyOn(process, 'kill').mockImplementation(throwEsrch);
      const registry = createChildGroupRegistry();

      registry.track(4242);

      expect(registry.terminateAll).not.toThrow();
    });

    it('WHEN the first group is tracked THEN one exit hook is installed for the registry', () => {
      const registry = createChildGroupRegistry();

      registry.track(4242);
      registry.track(4343);

      const exitHookCalls = vi.mocked(process.once).mock.calls.filter(([event]) => event === 'exit');

      expect(exitHookCalls).toStrictEqual([['exit', registry.terminateAll]]);
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

    it('WHEN the signal arrives THEN the groups are terminated and the signal is re-raised', () => {
      vi.spyOn(process, 'listenerCount').mockReturnValue(0);
      const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
      const registry = createChildGroupRegistry();

      registry.track(4242);

      const sigintCall = vi.mocked(process.once).mock.calls.find(([event]) => event === 'SIGINT');
      const forwardSignal = sigintCall?.[1];

      forwardSignal?.('SIGINT');

      expect(killSpy).toHaveBeenNthCalledWith(1, -4242, 'SIGTERM');
      expect(killSpy).toHaveBeenNthCalledWith(2, process.pid, 'SIGINT');
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
    it('WHEN the server exits THEN the group is not signalled', () => {
      const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
      const registry = createChildGroupRegistry();

      const untrack = registry.track(4242);

      untrack();
      registry.terminateAll();

      expect(killSpy).not.toHaveBeenCalled();
    });
  });
});
