/* eslint-disable @typescript-eslint/naming-convention */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handlePing } from './ping.handler.ts';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../../shared/common/execution-limits.const.ts';
import type { ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/provider-config.type.ts';

vi.mock('../../../shared/domain-logic/command-executor.ts', () => ({
  executeCommand: vi.fn(async () =>
    Promise.resolve({
      stdout: 'v1.0.0',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 6,
      stderrBytes: 0,
      executionTimeMs: 50,
    }),
  ),
}));

vi.mock('../../../shared/utils/platform.util.ts', () => ({
  buildMinimalEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
  stripAnsi: vi.fn((input: string) => input),
}));

// Real toMcpError — no mock (validates real error mapping)

const { executeCommand } = await import('../../../shared/domain-logic/command-executor.ts');
const { buildMinimalEnv, stripAnsi } = await import('../../../shared/utils/platform.util.ts');

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

describe('handlePing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(executeCommand).mockResolvedValue({
      stdout: 'v1.0.0',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 6,
      stderrBytes: 0,
      executionTimeMs: 50,
    });

    vi.mocked(buildMinimalEnv).mockReturnValue({ PATH: '/usr/bin' });
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
  });

  describe('no versionCheck configured', () => {
    it('GIVEN provider without versionCheck WHEN handling ping THEN returns available with binary path', async () => {
      const context = createContext();

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'test: available (binary: /usr/bin/test-cli)' }],
      });
    });

    it('GIVEN provider without versionCheck WHEN handling ping THEN does not call executeCommand', async () => {
      const context = createContext();

      await handlePing(context);

      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('successful version check', () => {
    it('GIVEN provider with versionCheck WHEN command succeeds THEN returns version output', async () => {
      const context = createContext({ versionCheck: { flag: '--version' } });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'test: available (version: v1.0.0)' }],
      });
    });

    it('GIVEN provider with versionCheck WHEN handling ping THEN calls executeCommand with correct args and 10s timeout', async () => {
      const context = createContext({ versionCheck: { flag: '--version' } });

      await handlePing(context);

      expect(executeCommand).toHaveBeenCalledWith({
        binaryPath: '/usr/bin/test-cli',
        args: ['--version'],
        env: { PATH: '/usr/bin' },
        timeoutMs: 10_000,
        bypassSemaphore: true,
      });
    });

    it('GIVEN provider env without MCP_TOOL_TIMEOUT WHEN handling ping THEN injects default timeout env', async () => {
      const context = createContext({
        versionCheck: { flag: '--version' },
        env: { API_KEY: 'secret' },
      });

      await handlePing(context);

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        API_KEY: 'secret',
        MCP_TOOL_TIMEOUT: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
    });

    it('GIVEN provider without MCP_TOOL_TIMEOUT WHEN handling ping THEN injects default timeout env', async () => {
      const context: ResolvedProviderEntry = {
        ...createContext({
          versionCheck: { flag: '--version' },
          env: { API_KEY: 'secret' },
        }),
        name: 'gemini',
      };

      await handlePing(context);

      expect(buildMinimalEnv).toHaveBeenCalledWith({
        API_KEY: 'secret',
        MCP_TOOL_TIMEOUT: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
      });
    });

    it('GIVEN output with ANSI codes WHEN handling ping THEN strips ANSI from output', async () => {
      const context = createContext({ versionCheck: { flag: '--version' } });

      vi.mocked(stripAnsi).mockReturnValue('v2.0.0');

      const result = await handlePing(context);

      expect(stripAnsi).toHaveBeenCalledWith('v1.0.0');
      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'test: available (version: v2.0.0)' }],
      });
    });

    it('GIVEN output with whitespace WHEN handling ping THEN trims the output', async () => {
      const context = createContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '  v1.0.0  ',
        stderr: '',
        exitCode: 0,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 10,
        stderrBytes: 0,
        executionTimeMs: 50,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'test: available (version: v1.0.0)' }],
      });
    });
  });

  describe('version pattern extraction', () => {
    it('GIVEN versionCheck with pattern WHEN output matches THEN extracts first capture group', async () => {
      const context = createContext({
        versionCheck: { flag: '--version', pattern: 'v(\\d+\\.\\d+\\.\\d+)' },
      });

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: 'test-cli v3.2.1 (build 42)',
        stderr: '',
        exitCode: 0,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 26,
        stderrBytes: 0,
        executionTimeMs: 50,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'test: available (version: 3.2.1)' }],
      });
    });

    it('GIVEN versionCheck with pattern WHEN output does not match THEN returns raw output', async () => {
      const context = createContext({
        versionCheck: { flag: '--version', pattern: 'version (\\d+)' },
      });

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: 'no match here',
        stderr: '',
        exitCode: 0,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 13,
        stderrBytes: 0,
        executionTimeMs: 50,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'test: available (version: no match here)' }],
      });
    });

    it('GIVEN versionCheck without pattern WHEN command succeeds THEN returns full output as version', async () => {
      const context = createContext({ versionCheck: { flag: '-V' } });

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: 'test-cli 4.5.6',
        stderr: '',
        exitCode: 0,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 14,
        stderrBytes: 0,
        executionTimeMs: 50,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'test: available (version: test-cli 4.5.6)' }],
      });
    });
  });

  describe('command failure', () => {
    it('GIVEN command times out WHEN handling ping THEN returns not responding', async () => {
      const context = createContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: null,
        signal: 'SIGTERM',
        timedOut: true,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 0,
        executionTimeMs: 10_000,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [
          {
            type: 'text',
            text: 'test: not responding (exit null, signal: SIGTERM, timedOut: true)',
          },
        ],
      });
    });

    it('GIVEN command exits non-zero WHEN handling ping THEN returns not responding', async () => {
      const context = createContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: 'error',
        exitCode: 1,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 5,
        executionTimeMs: 50,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [
          {
            type: 'text',
            text: 'test: not responding (exit 1, signal: null, timedOut: false)',
          },
        ],
      });
    });

    it('GIVEN command killed by signal WHEN handling ping THEN returns not responding', async () => {
      const context = createContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: null,
        signal: 'SIGKILL',
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 0,
        executionTimeMs: 50,
      });

      const result = await handlePing(context);

      expect(result).toStrictEqual({
        content: [
          {
            type: 'text',
            text: 'test: not responding (exit null, signal: SIGKILL, timedOut: false)',
          },
        ],
      });
    });
  });

  describe('unexpected errors', () => {
    it('GIVEN executeCommand throws WHEN handling ping THEN returns isError response', async () => {
      const context = createContext({ versionCheck: { flag: '--version' } });

      vi.mocked(executeCommand).mockRejectedValue(new Error('spawn ENOENT'));

      const result = await handlePing(context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('spawn ENOENT');
    });

    it('GIVEN buildMinimalEnv throws WHEN handling ping THEN returns isError response', async () => {
      const context = createContext({ versionCheck: { flag: '--version' } });

      vi.mocked(buildMinimalEnv).mockImplementation(() => {
        throw new Error('env construction failed');
      });

      const result = await handlePing(context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('env construction failed');
    });
  });
});
