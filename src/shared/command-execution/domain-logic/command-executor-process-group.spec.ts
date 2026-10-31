import type { ChildProcess } from 'node:child_process';

import crossSpawn from 'cross-spawn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommand } from './command-executor';
import { TEST_EXECUTE_COMMAND_OPTIONS_STUB } from '../test/stubs/execute-command-options.stub';
import { createControllableChild } from '../test/utils/controllable-child.spec.util';

const mocks = vi.hoisted(() => {
  const untrack = vi.fn();
  const track = vi.fn(() => untrack);
  const terminateAll = vi.fn();

  const result = { untrack, track, terminateAll };

  return result;
});

vi.mock('cross-spawn', () => {
  const mockedModule = { default: vi.fn() };

  return mockedModule;
});

vi.mock('./child-group-registry', () => {
  const defaultChildGroupRegistry = { track: mocks.track, terminateAll: mocks.terminateAll };
  const mockedModule = { defaultChildGroupRegistry };

  return mockedModule;
});

type CrossSpawnResult = ChildProcess;

const baseOptions = { ...TEST_EXECUTE_COMMAND_OPTIONS_STUB, bypassSemaphore: true };
const originalPlatform = process.platform;

const setPlatform = (platform: NodeJS.Platform): void => {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
};

const runToClose = async (pid?: number): Promise<void> => {
  const controllable = createControllableChild(pid);

  vi.mocked(crossSpawn).mockReturnValue(controllable.child as unknown as CrossSpawnResult);

  const resultPromise = executeCommand(baseOptions);

  controllable.emitClose(0, null);
  await resultPromise;
};

describe('FEATURE: executeCommand process group tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  describe('GIVEN a POSIX host and a child with a pid', () => {
    beforeEach(() => {
      setPlatform('linux');
    });

    it('WHEN the child is spawned THEN its group is tracked for termination on server exit', async () => {
      await runToClose(1357);

      expect(mocks.track).toHaveBeenCalledWith(1357);
    });

    it('WHEN the child closes THEN its group is untracked', async () => {
      await runToClose(1357);

      expect(mocks.untrack).toHaveBeenCalledOnce();
    });
  });

  describe('GIVEN a POSIX host and a child without a pid', () => {
    it('WHEN the spawn produced no process THEN nothing is tracked', async () => {
      setPlatform('linux');

      await runToClose();

      expect(mocks.track).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a win32 host', () => {
    it('WHEN a child is spawned THEN nothing is tracked because the child shares no detached group', async () => {
      setPlatform('win32');

      await runToClose(1357);

      expect(mocks.track).not.toHaveBeenCalled();
    });
  });
});
