import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler.ts';
import type { ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/provider-config.type.ts';

vi.mock('./arg.builder.ts', () => ({
  buildArgArray: vi.fn(() => ({ args: ['exec', 'test prompt'], stdinInput: undefined })),
}));

vi.mock('../../../shared/domain-logic/command-executor.ts', () => ({
  executeCommand: vi.fn(async () =>
    Promise.resolve({
      stdout: 'command output',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 14,
      stderrBytes: 0,
      executionTimeMs: 100,
    }),
  ),
}));

vi.mock('../../../shared/utils/platform.util.ts', () => ({
  buildMinimalEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
  stripAnsi: vi.fn((input: string) => input),
}));

const { buildArgArray } = await import('./arg.builder.ts');
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

describe('handleAsk', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(buildArgArray).mockReturnValue({ args: ['exec', 'test prompt'], stdinInput: undefined });

    vi.mocked(executeCommand).mockResolvedValue({
      stdout: 'command output',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 14,
      stderrBytes: 0,
      executionTimeMs: 100,
    });

    vi.mocked(buildMinimalEnv).mockReturnValue({ PATH: '/usr/bin' });
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
  });

  describe('command failure', () => {
    it('GIVEN command times out WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: null,
        signal: null,
        timedOut: true,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 0,
        executionTimeMs: 120_000,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.type).toBe('text');
      expect((result.content[0] as { text: string }).text).toContain('timed out');
    });

    it('GIVEN command killed by signal WHEN handling ask THEN returns isError response with signal info', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: null,
        signal: 'SIGKILL',
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 0,
        executionTimeMs: 500,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('SIGKILL');
    });

    it('GIVEN non-zero exit code WHEN handling ask THEN returns isError response with exit code', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: 'something went wrong',
        exitCode: 1,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 20,
        executionTimeMs: 200,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Exit code: 1');
    });

    it('GIVEN non-zero exit code with stderr WHEN handling ask THEN includes stderr in error response', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: 'fatal: unknown flag',
        exitCode: 2,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 19,
        executionTimeMs: 50,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('fatal: unknown flag');
    });
  });

  describe('response text cap', () => {
    it('GIVEN output within MAX_RESPONSE_TEXT_BYTES WHEN handling ask THEN returns full output without truncation marker', async () => {
      const context = createContext();
      const shortOutput = 'a'.repeat(100);

      vi.mocked(stripAnsi).mockReturnValue(shortOutput);

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect((result.content[0] as { text: string }).text).toBe(shortOutput);
      expect((result.content[0] as { text: string }).text).not.toContain('[output truncated');
    });

    it('GIVEN output exceeding MAX_RESPONSE_TEXT_BYTES WHEN handling ask THEN truncates output and appends marker with byte count', async () => {
      const context = createContext();
      const largeOutput = 'b'.repeat(200 * 1024 + 500);

      vi.mocked(stripAnsi).mockReturnValue(largeOutput);

      const result = await handleAsk(context, { prompt: 'test prompt' });

      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('[output truncated —');
      expect(text).toContain('bytes total]');
      expect(text.length).toBeLessThan(largeOutput.length);
    });
  });

  describe('model error detection', () => {
    it('GIVEN exit 0 with model-not-found in stdout WHEN handling ask THEN returns isError with model hint', async () => {
      const context = createContext();
      const modelError = '{"type":"error","error":{"message":"Model not found: opencode/bad-model."}}';

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: modelError,
        stderr: '',
        exitCode: 0,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: modelError.length,
        stderrBytes: 0,
        executionTimeMs: 200,
      });

      vi.mocked(stripAnsi).mockReturnValue(modelError);

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);

      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('Model not found');
      expect(text).toContain('Hint:');
      expect(text).toContain('test models');
    });

    it('GIVEN non-zero exit with model error in stderr WHEN handling ask THEN returns isError with model hint', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockResolvedValue({
        stdout: '',
        stderr: 'Error: unknown model "bad-model"',
        exitCode: 1,
        signal: null,
        timedOut: false,
        truncated: false,
        stdoutBytes: 0,
        stderrBytes: 31,
        executionTimeMs: 100,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);

      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('Hint:');
      expect(text).toContain('test models');
    });

    it('GIVEN normal output without model errors WHEN handling ask THEN returns success without hint', async () => {
      const context = createContext();

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).not.toContain('Hint:');
    });
  });

  describe('unexpected errors', () => {
    it('GIVEN executeCommand throws WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      vi.mocked(executeCommand).mockRejectedValue(new Error('spawn ENOENT'));

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('spawn ENOENT');
    });

    it('GIVEN buildArgArray throws WHEN handling ask THEN returns isError response', async () => {
      const context = createContext();

      vi.mocked(buildArgArray).mockImplementation(() => {
        throw new Error('arg builder failed');
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('arg builder failed');
    });
  });
});
