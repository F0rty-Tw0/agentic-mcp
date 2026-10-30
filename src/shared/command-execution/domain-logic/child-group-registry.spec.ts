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

      expect(process.once).toHaveBeenCalledExactlyOnceWith('exit', registry.terminateAll);
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
