import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler';
import { buildArgArray } from '../../cli-args/domain-logic/arg.builder';
import type { ExecutionResult } from '../../shared';
import { buildMinimalEnv, executeCommand, stripAnsi } from '../../shared';
import { TEST_MINIMAL_ENV_STUB } from '../../shared/command-execution/test/stubs/env.stub';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { AskToolStructuredContent } from '../common';
import { ASK_DEFAULT_ARG_ARRAY_STUB } from '../test/stubs/ask-arg-array.stub';
import { ASK_SUCCESS_EXECUTION_RESULT_STUB } from '../test/stubs/ask-execution-result.stub';
import { createAskContext } from '../test/utils/ask-context.spec.util';
import { readFirstText } from '../test/utils/text-content.spec.util';

vi.mock('../../cli-args/domain-logic/arg.builder', () => {
  const result = {
    buildArgArray: vi.fn(() => ASK_DEFAULT_ARG_ARRAY_STUB),
  };

  return result;
});

vi.mock('../../shared/command-execution/domain-logic/command-executor', () => {
  const result = {
    executeCommand: vi.fn(),
  };

  return result;
});

vi.mock('../../shared/command-execution/domain-logic/platform', () => {
  const result = {
    buildMinimalEnv: vi.fn(() => TEST_MINIMAL_ENV_STUB),
  };

  return result;
});

vi.mock('../../shared/command-execution/utils/platform.util', () => {
  const result = {
    stripAnsi: vi.fn((input: string) => input),
  };

  return result;
});

vi.mock('../../shared/provider/utils/model-error.util', () => {
  const fetchAvailableModelsMock = vi.fn().mockResolvedValue(undefined);
  const result = {
    detectModelError: vi.fn(() => false),
    extractAttemptedModel: vi.fn(() => undefined),
    fetchAvailableModels: fetchAvailableModelsMock,
    buildModelHint: vi.fn(() => ''),
  };

  return result;
});

const COMPLETE_ENVELOPE = '{"status":"SUCCESS","response":"agy answer","conversation_id":"conv-1"}\n';

const buildKilledResult = (stdout: string): ExecutionResult => {
  const result: ExecutionResult = {
    ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
    stdout,
    stdoutBytes: stdout.length,
    exitCode: null,
    signal: 'SIGKILL',
    timedOut: true,
  };

  return result;
};

const readStructured = (structuredContent: unknown): AskToolStructuredContent | undefined => {
  const isStructured = (value: unknown): value is AskToolStructuredContent =>
    typeof value === 'object' && value !== null && 'attribution' in value;

  if (!isStructured(structuredContent)) return;

  return structuredContent;
};

describe('FEATURE: ask result accepted after a timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildArgArray).mockReturnValue(ASK_DEFAULT_ARG_ARRAY_STUB);
    vi.mocked(buildMinimalEnv).mockReturnValue(TEST_MINIMAL_ENV_STUB);
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
  });

  describe('GIVEN a provider that opts in with acceptResultOnTimeout', () => {
    const context = createAskContext({ acceptResultOnTimeout: true });

    describe('WHEN the run is killed after a complete result envelope', () => {
      beforeEach(() => {
        vi.mocked(executeCommand).mockResolvedValue(buildKilledResult(COMPLETE_ENVELOPE));
      });

      it('THEN the response is a success', async () => {
        const result = await handleAsk(context, { prompt: 'test prompt' });

        expect(result.isError).toBeUndefined();
      });

      it('THEN the response text is the printed answer', async () => {
        const result = await handleAsk(context, { prompt: 'test prompt' });

        expect(readFirstText(result)).toBe('agy answer');
      });

      it('THEN the attribution carries a warning about the stopped process', async () => {
        const result = await handleAsk(context, { prompt: 'test prompt', include_structured: true });
        const structured = readStructured(result.structuredContent);

        expect(structured?.attribution.warning).toContain('did not exit');
      });
    });

    it('WHEN the run is killed before the envelope is complete THEN the response is a timeout error', async () => {
      vi.mocked(executeCommand).mockResolvedValue(buildKilledResult('{"status":"SUCCESS","resp'));

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(readFirstText(result)).toContain('timed out');
    });

    it('WHEN the envelope answer is empty THEN the response is a timeout error', async () => {
      vi.mocked(executeCommand).mockResolvedValue(buildKilledResult('{"status":"SUCCESS","response":"  "}'));

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
    });

    it('WHEN the killed run printed an error envelope THEN the response is an error', async () => {
      const errorEnvelope =
        '{"status":"ERROR","error":"RESOURCE_EXHAUSTED: quota","response":"I started to answer but"}';

      vi.mocked(executeCommand).mockResolvedValue(buildKilledResult(errorEnvelope));

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(result.isError).toBe(true);
    });

    it('WHEN the caller cancelled the run THEN the response is an error', async () => {
      const controller = new AbortController();
      const sendNotification = async (): Promise<void> => {
        await Promise.resolve();
      };
      const extra: ProgressContext = { signal: controller.signal, sendNotification };

      controller.abort();
      vi.mocked(executeCommand).mockResolvedValue(buildKilledResult(COMPLETE_ENVELOPE));

      const result = await handleAsk(context, { prompt: 'test prompt' }, extra);

      expect(result.isError).toBe(true);
    });

    it('WHEN the run exits normally THEN the attribution has no warning', async () => {
      const finished: ExecutionResult = { ...ASK_SUCCESS_EXECUTION_RESULT_STUB, stdout: COMPLETE_ENVELOPE };

      vi.mocked(executeCommand).mockResolvedValue(finished);

      const result = await handleAsk(context, { prompt: 'test prompt', include_structured: true });
      const structured = readStructured(result.structuredContent);

      expect(structured?.attribution.warning).toBeUndefined();
    });
  });

  it('GIVEN a provider whose run exits after a print timeout WHEN asked THEN the attribution warns that the answer may be partial', async () => {
    const stdout = '{"status":"SUCCESS","response":"half","finished_reason":"print_timeout"}\n';
    const finished: ExecutionResult = { ...ASK_SUCCESS_EXECUTION_RESULT_STUB, stdout };

    vi.mocked(executeCommand).mockResolvedValue(finished);

    const result = await handleAsk(createAskContext(), { prompt: 'test prompt', include_structured: true });
    const structured = readStructured(result.structuredContent);

    expect(structured?.attribution.warning).toContain('may be partial');
  });

  describe('GIVEN a provider without the opt-in', () => {
    const context = createAskContext();

    it('WHEN the run is killed after a complete result envelope THEN the response is a timeout error', async () => {
      vi.mocked(executeCommand).mockResolvedValue(buildKilledResult(COMPLETE_ENVELOPE));

      const result = await handleAsk(context, { prompt: 'test prompt' });

      expect(readFirstText(result)).toContain('timed out');
    });
  });
});
