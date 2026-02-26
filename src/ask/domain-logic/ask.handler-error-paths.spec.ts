import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler';
import type { McpPlainTextContent } from '../../shared/common';
import { TEST_MINIMAL_ENV_STUB } from '../../shared/common/stubs';
import { executeCommand } from '../../shared/domain-logic/command-executor';
import { buildModelHint, detectModelError } from '../../shared/utils/model-error.util';
import { buildMinimalEnv, stripAnsi } from '../../shared/utils/platform.util';
import { buildArgArray } from '../cli-args/domain-logic/arg.builder';
import {
  ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB,
  ASK_DEFAULT_ARG_ARRAY_STUB,
  ASK_SUCCESS_EXECUTION_RESULT_STUB,
  createAskContext,
} from '../common/stubs';

vi.mock('../cli-args/domain-logic/arg.builder', () => ({
  buildArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
}));

vi.mock('../../shared/domain-logic/command-executor', () => ({
  executeCommand: vi.fn(async () => Promise.resolve(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB)),
}));

vi.mock('../../shared/utils/platform.util', () => ({
  buildMinimalEnv: vi.fn(() => TEST_MINIMAL_ENV_STUB),
  stripAnsi: vi.fn((input: string) => input),
}));

vi.mock('../../shared/utils/model-error.util', () => ({
  detectModelError: vi.fn(() => false),
  extractAttemptedModel: vi.fn(() => undefined),
  fetchAvailableModels: vi.fn().mockResolvedValue(undefined),
  buildModelHint: vi.fn(() => ''),
}));

describe('handleAsk', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(buildArgArray).mockReturnValue(ASK_DEFAULT_ARG_ARRAY_STUB);

    vi.mocked(executeCommand).mockResolvedValue(ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB);

    vi.mocked(buildMinimalEnv).mockReturnValue(TEST_MINIMAL_ENV_STUB);
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
  });

  describe('command failure', () => {
    it('GIVEN command times out WHEN handling ask THEN returns isError response', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        exitCode: null,
        signal: null,
        timedOut: true,
        executionTimeMs: 120_000,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.type).toBe('text');
      expect((result.content[0] as McpPlainTextContent).text).toContain('timed out');
    });

    it('GIVEN command killed by signal WHEN handling ask THEN returns isError response with signal info', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        exitCode: null,
        signal: 'SIGKILL',
        timedOut: false,
        executionTimeMs: 500,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('SIGKILL');
    });

    it('GIVEN non-zero exit code WHEN handling ask THEN returns isError response with exit code', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        stderr: 'something went wrong',
        exitCode: 1,
        stderrBytes: 20,
        executionTimeMs: 200,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('Exit code: 1');
    });

    it('GIVEN non-zero exit code with stderr WHEN handling ask THEN includes stderr in error response', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        stderr: 'fatal: unknown flag',
        exitCode: 2,
        stderrBytes: 19,
        executionTimeMs: 50,
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('fatal: unknown flag');
    });
  });

  describe('response text cap', () => {
    it('GIVEN output within MAX_RESPONSE_TEXT_BYTES WHEN handling ask THEN returns full output without truncation marker', async () => {
      const context = createAskContext();
      const shortOutput = 'a'.repeat(100);

      vi.mocked(stripAnsi).mockReturnValue(shortOutput);

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect((result.content[0] as McpPlainTextContent).text).toBe(shortOutput);
      expect((result.content[0] as McpPlainTextContent).text).not.toContain('[output truncated');
    });

    it('GIVEN output exceeding MAX_RESPONSE_TEXT_BYTES WHEN handling ask THEN truncates output and appends marker with byte count', async () => {
      const context = createAskContext();
      const largeOutput = 'b'.repeat(200 * 1024 + 500);

      vi.mocked(stripAnsi).mockReturnValue(largeOutput);

      const result = await handleAsk(context, { prompt: 'test prompt' });

      const text = (result.content[0] as McpPlainTextContent).text;

      expect(text).toContain('[output truncated —');
      expect(text).toContain('bytes total]');
      expect(text.length).toBeLessThan(largeOutput.length);
    });
  });

  describe('model error branching', () => {
    it('GIVEN non-zero exit with model error detected WHEN handling ask THEN appends model hint suffix to error', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: '',
        stderr: 'unknown model "bad-model"',
        exitCode: 1,
        stderrBytes: 25,
        executionTimeMs: 100,
      });

      vi.mocked(detectModelError).mockReturnValue(true);
      vi.mocked(buildModelHint).mockReturnValue('\n\nModel error: "bad-model" is not available');

      const result = await handleAsk(context, { prompt: 'test prompt', model: 'bad-model' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('Model error: "bad-model" is not available');
    });

    it('GIVEN exit 0 with model error in stdout WHEN handling ask THEN returns isError with model hint', async () => {
      const context = createAskContext();
      const modelError = 'Model not found: bad-model';

      vi.mocked(executeCommand).mockResolvedValue({
        ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
        stdout: modelError,
        stdoutBytes: modelError.length,
        executionTimeMs: 200,
      });

      vi.mocked(stripAnsi).mockReturnValue(modelError);
      vi.mocked(detectModelError).mockReturnValue(true);
      vi.mocked(buildModelHint).mockReturnValue('\n\nModel error: "bad-model" is not available');

      const result = await handleAsk(context, { prompt: 'test prompt', model: 'bad-model' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain(modelError);
      expect((result.content[0] as McpPlainTextContent).text).toContain('Model error: "bad-model" is not available');
    });
  });

  describe('unexpected errors', () => {
    it('GIVEN executeCommand throws WHEN handling ask THEN returns isError response', async () => {
      const context = createAskContext();

      vi.mocked(executeCommand).mockRejectedValue(new Error('spawn ENOENT'));

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('spawn ENOENT');
    });

    it('GIVEN buildArgArray throws WHEN handling ask THEN returns isError response', async () => {
      const context = createAskContext();

      vi.mocked(buildArgArray).mockImplementation(() => {
        throw new Error('arg builder failed');
      });

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpPlainTextContent).text).toContain('arg builder failed');
    });
  });
});
