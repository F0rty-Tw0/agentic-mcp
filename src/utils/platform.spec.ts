import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildMinimalEnv, killProcess, normalizePath, resolveCliBinary, stripAnsi } from './platform.ts';
import type { AsyncViFn, SyncViFn } from '../test-utils/vi-fn.types.ts';

type ExecFileCallback = (error: NodeJS.ErrnoException | null) => void;

type ExecFileMock = SyncViFn<[file: string, args: string[], callback: ExecFileCallback], void>;

type WhichMock = AsyncViFn<[command: string, options: { nothrow: boolean }], string | null>;

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

  it('GIVEN win32 platform WHEN killProcess taskkill succeeds THEN it returns true', async () => {
    mocks.execFile.mockImplementation((_file, _args, callback) => {
      callback(null);
    });

    const result = await killProcess(1234);

    expect(result).toBe(true);
    expect(mocks.execFile).toHaveBeenCalledWith('taskkill', ['/pid', '1234', '/t', '/f'], expect.any(Function));
  });

  it('GIVEN win32 platform WHEN killProcess taskkill fails THEN it returns false', async () => {
    mocks.execFile.mockImplementation((_file, _args, callback) => {
      callback(new Error('taskkill failed'));
    });

    const result = await killProcess(1234);

    expect(result).toBe(false);
  });

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

  it('GIVEN a command name WHEN resolving CLI binary THEN it delegates to which with nothrow true', async () => {
    mocks.which.mockResolvedValue('/bin/agentic');

    const result = await resolveCliBinary('agentic');

    expect(result).toBe('/bin/agentic');
    expect(mocks.which).toHaveBeenCalledWith('agentic', { nothrow: true });
  });

  it('GIVEN ANSI-colored output WHEN stripping ANSI THEN only visible text remains', () => {
    const result = stripAnsi('\u001B[31merror\u001B[39m');

    expect(result).toBe('error');
  });

  it('GIVEN a relative Windows-style path WHEN normalizing THEN it returns an absolute path with forward slashes', () => {
    const result = normalizePath('.\\src\\utils\\..\\index.ts');

    expect(result).toMatch(/\/src\/index\.ts$/);
    expect(result.includes('\\')).toBe(false);
  });
});
