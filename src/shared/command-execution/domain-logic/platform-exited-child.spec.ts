import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { killProcess } from './platform';
import type { SyncViFn } from '../test/common/vi-fn.type';

type ExecFileCallback = (error: NodeJS.ErrnoException | null) => void;

type ExecFileMock = SyncViFn<[file: string, args: string[], callback: ExecFileCallback], void>;

const mocks = vi.hoisted(() => {
  const execFile = vi.fn<ExecFileMock>();
  const result = { execFile };

  return result;
});

vi.mock('node:child_process', () => {
  const mockedModule = { execFile: mocks.execFile };

  return mockedModule;
});

const CHILD_PID = 123;

const throwForGroupTarget = (target: number): true => {
  if (target < 0) throw new Error('ESRCH');

  return true;
};

// The group takes SIGTERM, then is gone by the first liveness probe.
const groupExitsOnSigterm = (_target: number, signal?: string | number): true => {
  if (signal === 0) throw new Error('ESRCH');

  return true;
};

describe('FEATURE: kill a child that already exited', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    mocks.execFile.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  describe('GIVEN posix and a child that exited with no group left', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    });

    it('WHEN killed THEN the bare pid is never signalled, since another process may have reused it', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(throwForGroupTarget);

      await killProcess(CHILD_PID, { childExited: true });

      expect(killSpy).not.toHaveBeenCalledWith(CHILD_PID, 'SIGTERM');
    });

    it('WHEN killed THEN it reports that nothing was signalled', async () => {
      vi.spyOn(process, 'kill').mockImplementation(throwForGroupTarget);

      const result = await killProcess(CHILD_PID, { childExited: true });

      expect(result).toBe(false);
    });
  });

  describe('GIVEN posix and a child that exited while its group lives on', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    });

    it('WHEN killed THEN the group still gets SIGTERM, since its id stays reserved while members live', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(groupExitsOnSigterm);

      const result = await killProcess(CHILD_PID, { childExited: true });

      expect(killSpy).toHaveBeenCalledWith(-CHILD_PID, 'SIGTERM');
      expect(result).toBe(true);
    });
  });

  describe('GIVEN win32 and a child that exited', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    });

    it('WHEN killed THEN taskkill is not run against a pid another process may have reused', async () => {
      const result = await killProcess(CHILD_PID, { childExited: true });

      expect(result).toBe(false);
      expect(mocks.execFile).not.toHaveBeenCalled();
    });
  });
});
