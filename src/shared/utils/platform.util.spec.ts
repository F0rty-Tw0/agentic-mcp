import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildMinimalEnv, killProcess, resolveCliBinary, stripAnsi } from './platform.util.ts';
import type { AsyncViFn, SyncViFn } from '../common/test-utils/vi-fn.types.ts';

type ExecFileCallback = (error: NodeJS.ErrnoException | null) => void;

type ExecFileMock = SyncViFn<[file: string, args: string[], callback: ExecFileCallback], void>;

type WhichMock = AsyncViFn<[command: string, options: { readonly nothrow: boolean }], string | null>;

const mocks = vi.hoisted(() => {
  const execFile = vi.fn<ExecFileMock>();
  const which = vi.fn<WhichMock>();

  return {
    execFile,
    which,
  };
});

vi.mock('node:child_process', () => ({
  execFile: mocks.execFile,
}));

vi.mock('which', () => ({
  default: mocks.which,
}));

describe('platform utilities', () => {
  beforeEach(() => {
    mocks.execFile.mockReset();
    mocks.which.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('killProcess', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    describe('win32', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      });

      it('GIVEN win32 platform WHEN taskkill succeeds THEN returns true', async () => {
        mocks.execFile.mockImplementation((_file, _args, callback) => {
          callback(null);
        });

        const result = await killProcess(1234);

        expect(result).toBe(true);
        expect(mocks.execFile).toHaveBeenCalledWith('taskkill', ['/pid', '1234', '/t', '/f'], expect.any(Function));
      });

      it('GIVEN win32 platform WHEN taskkill fails THEN returns false', async () => {
        mocks.execFile.mockImplementation((_file, _args, callback) => {
          callback(new Error('taskkill failed'));
        });

        const result = await killProcess(1234);

        expect(result).toBe(false);
      });
    });

    describe('posix', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
        vi.useFakeTimers();
      });

      it('GIVEN SIGTERM throws WHEN called THEN returns false', async () => {
        vi.spyOn(process, 'kill').mockImplementation(() => {
          throw new Error('ESRCH');
        });

        expect(await killProcess(123)).toBe(false);
      });

      it('GIVEN process exits immediately WHEN first poll runs THEN returns true without SIGKILL', async () => {
        const killSpy = vi.spyOn(process, 'kill').mockImplementation((_pid: number, signal?: string | number): true => {
          if (signal === 0) throw new Error('ESRCH');

          return true;
        });

        const promise = killProcess(123);

        await vi.advanceTimersByTimeAsync(150);

        expect(await promise).toBe(true);
        expect(killSpy).toHaveBeenCalledWith(123, 'SIGTERM');
        expect(killSpy).not.toHaveBeenCalledWith(123, 'SIGKILL');
      });

      it('GIVEN process exits after several polls WHEN polled THEN returns true', async () => {
        let pollCount = 0;

        vi.spyOn(process, 'kill').mockImplementation((_pid: number, signal?: string | number): true => {
          if (signal === 0) {
            pollCount++;

            if (pollCount >= 3) throw new Error('ESRCH');

            return true;
          }

          return true;
        });

        const promise = killProcess(123);

        await vi.advanceTimersByTimeAsync(500);

        expect(await promise).toBe(true);
        expect(pollCount).toBeGreaterThanOrEqual(3);
      });

      it('GIVEN process does not exit WHEN grace period expires THEN sends SIGKILL and returns true', async () => {
        const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);

        const promise = killProcess(123);

        await vi.advanceTimersByTimeAsync(5_100);

        expect(await promise).toBe(true);
        expect(killSpy).toHaveBeenCalledWith(123, 'SIGKILL');
      });

      it('GIVEN process exits between last poll and kill timer WHEN SIGKILL throws THEN still returns true', async () => {
        vi.spyOn(process, 'kill').mockImplementation((_pid: number, signal?: string | number): true => {
          if (signal === 'SIGKILL') throw new Error('ESRCH');

          return true;
        });

        const promise = killProcess(123);

        await vi.advanceTimersByTimeAsync(5_100);

        expect(await promise).toBe(true);
      });

      it('GIVEN polling already settled WHEN kill timer fires later THEN no SIGKILL is sent', async () => {
        const killSpy = vi.spyOn(process, 'kill').mockImplementation((_pid: number, signal?: string | number): true => {
          if (signal === 0) throw new Error('ESRCH');

          return true;
        });

        const promise = killProcess(123);

        await vi.advanceTimersByTimeAsync(150);
        await promise;

        // Advance well past the grace period — kill timer should be cleared or settled-guarded
        await vi.advanceTimersByTimeAsync(6_000);

        expect(killSpy).not.toHaveBeenCalledWith(123, 'SIGKILL');
      });

      it('GIVEN kill timer already settled WHEN subsequent poll fires THEN poll returns without checking process', async () => {
        const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);

        const promise = killProcess(123);

        await vi.advanceTimersByTimeAsync(5_000);
        await promise;

        const callCountAtSettle = killSpy.mock.calls.length;

        // Advance more — any scheduled polls should see settled and return early
        await vi.advanceTimersByTimeAsync(1_000);

        expect(killSpy.mock.calls).toHaveLength(callCountAtSettle);
      });

      it('GIVEN successful kill WHEN called THEN sends SIGTERM as the first signal', async () => {
        const signals: (string | number | undefined)[] = [];

        vi.spyOn(process, 'kill').mockImplementation((_pid: number, signal?: string | number): true => {
          signals.push(signal);

          if (signal === 0) throw new Error('ESRCH');

          return true;
        });

        const promise = killProcess(123);

        await vi.advanceTimersByTimeAsync(150);
        await promise;

        expect(signals[0]).toBe('SIGTERM');
      });
    });
  });

  describe('buildMinimalEnv', () => {
    it('GIVEN provider env values WHEN building minimal env THEN provider values override safe keys and null maps to empty string', () => {
      vi.stubEnv('PATH', '/usr/bin');
      vi.stubEnv('HOME', '/home/tester');

      const env = buildMinimalEnv({
        PATH: '/custom/bin',
        feature_flag: 'on',
        null_setting: null,
      });

      expect(env.PATH).toBe('/custom/bin');
      expect(env.HOME).toBe('/home/tester');
      expect(env.feature_flag).toBe('on');
      expect(env.null_setting).toBe('');
    });

    it('GIVEN non-safe key in process.env WHEN building minimal env THEN it is excluded', () => {
      vi.stubEnv('_TEST_UNSAFE_', 'secret');

      const env = buildMinimalEnv({});

      expect('_TEST_UNSAFE_' in env).toBe(false);
    });
  });

  describe('resolveCliBinary', () => {
    it('GIVEN existing binary WHEN resolving THEN returns the resolved path', async () => {
      mocks.which.mockResolvedValue('/bin/agentic');

      const result = await resolveCliBinary('agentic');

      expect(result).toBe('/bin/agentic');
      expect(mocks.which).toHaveBeenCalledWith('agentic', { nothrow: true });
    });

    it('GIVEN nonexistent binary WHEN resolving THEN returns null', async () => {
      mocks.which.mockResolvedValue(null);

      const result = await resolveCliBinary('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('stripAnsi', () => {
    it('GIVEN ANSI-colored output WHEN stripping ANSI THEN only visible text remains', () => {
      expect(stripAnsi('\u001B[31merror\u001B[39m')).toBe('error');
    });

    it('GIVEN plain string WHEN stripping ANSI THEN returns unchanged', () => {
      expect(stripAnsi('plain')).toBe('plain');
    });

    it('GIVEN empty string WHEN stripping ANSI THEN returns empty string', () => {
      expect(stripAnsi('')).toBe('');
    });
  });
});
