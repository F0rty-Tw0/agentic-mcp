/* eslint-disable @typescript-eslint/naming-convention */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleHelp } from './help-handler.ts';
import type { ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/provider-config.type.ts';

vi.mock('../../../shared/domain-logic/command-executor.ts', () => ({
  executeCommand: vi.fn(async () =>
    Promise.resolve({
      stdout: 'Usage: test-cli [options]',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 25,
      stderrBytes: 0,
      executionTimeMs: 50,
    }),
  ),
}));

vi.mock('../../../shared/utils/platform.ts', () => ({
  buildMinimalEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
  stripAnsi: vi.fn((input: string) => input),
}));

// Real toMcpError — no mock (validates real error mapping)

const { executeCommand } = await import('../../../shared/domain-logic/command-executor.ts');
const { buildMinimalEnv, stripAnsi } = await import('../../../shared/utils/platform.ts');

const createContext = (overrides: Partial<ProviderConfig> = {}): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    enabled: true,
    description: 'Test provider',
    command: 'test-cli',
    timeout: 120_000,
    env: {},
    outputFormat: 'json',
    commands: { ask: { args: ['exec'], flags: {} } },
    input: { method: 'positional' },
    ...overrides,
  };

  return { name: 'test', binaryPath: '/usr/bin/test-cli', config };
};

describe('handleHelp', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(executeCommand).mockResolvedValue({
      stdout: 'Usage: test-cli [options]',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 25,
      stderrBytes: 0,
      executionTimeMs: 50,
    });

    vi.mocked(buildMinimalEnv).mockReturnValue({ PATH: '/usr/bin' });
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
  });

  describe('successful execution', () => {
    it('GIVEN provider context WHEN handling help THEN returns text content with help output', async () => {
      const context = createContext();

      const result = await handleHelp(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'Usage: test-cli [options]' }],
      });
    });

    it('GIVEN provider context WHEN handling help THEN calls buildMinimalEnv with provider env', async () => {
      const context = createContext({ env: { API_KEY: 'secret' } });

      await handleHelp(context);

      expect(buildMinimalEnv).toHaveBeenCalledWith({ API_KEY: 'secret' });
    });

    it('GIVEN provider context WHEN handling help THEN calls executeCommand with --help flag and 10s timeout', async () => {
      const context = createContext();

      await handleHelp(context);

      expect(executeCommand).toHaveBeenCalledWith({
        binaryPath: '/usr/bin/test-cli',
        args: ['--help'],
        env: { PATH: '/usr/bin' },
        timeoutMs: 10_000,
        bypassSemaphore: true,
      });
    });

    it('GIVEN output with ANSI codes WHEN handling help THEN strips ANSI from output', async () => {
      const context = createContext();

      vi.mocked(stripAnsi).mockReturnValue('clean help output');

      const result = await handleHelp(context);

      expect(stripAnsi).toHaveBeenCalledWith('Usage: test-cli [options]');
      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'clean help output' }],
      });
    });

    it('GIVEN output with whitespace WHEN handling help THEN trims the output', async () => {
      const context = createContext();

      vi.mocked(stripAnsi).mockReturnValue('  help output  ');

      const result = await handleHelp(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'help output' }],
      });
    });
  });

  describe('stderr fallback', () => {
    it('GIVEN empty stdout WHEN handling help THEN falls back to stderr', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: 'Usage from stderr',
        exitCode: 0,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 17,
        executionTimeMs: 50,
      });

      await handleHelp(context);

      expect(stripAnsi).toHaveBeenCalledWith('Usage from stderr');
    });

    it('GIVEN both stdout and stderr WHEN handling help THEN prefers stdout', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: 'stdout help',
        stderr: 'stderr help',
        exitCode: 0,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 11,
        stderrBytes: 11,
        executionTimeMs: 50,
      });

      await handleHelp(context);

      expect(stripAnsi).toHaveBeenCalledWith('stdout help');
    });
  });

  describe('non-zero exit code', () => {
    it('GIVEN CLI exits non-zero for --help WHEN handling help THEN still returns output (not error)', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: 'Usage: stubborn-cli [options]',
        stderr: '',
        exitCode: 1,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 28,
        stderrBytes: 0,
        executionTimeMs: 50,
      });

      const result = await handleHelp(context);

      expect(result.isError).toBeUndefined();
      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'Usage: stubborn-cli [options]' }],
      });
    });
  });

  describe('unexpected errors', () => {
    it('GIVEN executeCommand throws WHEN handling help THEN returns isError response', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockRejectedValue(new Error('spawn ENOENT'));

      const result = await handleHelp(context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('spawn ENOENT');
    });

    it('GIVEN buildMinimalEnv throws WHEN handling help THEN returns isError response', async () => {
      const context = createContext();

      vi.mocked(buildMinimalEnv).mockImplementation(() => {
        throw new Error('env construction failed');
      });

      const result = await handleHelp(context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('env construction failed');
    });
  });
});
