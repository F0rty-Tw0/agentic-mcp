import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAskAll } from './ask-all.handler';
import {
  EXPLICIT_SHARED_MODEL,
  makeErrorResult,
  makeProvider,
  makeSuccessResult,
  parseResult,
  resolveExplicitModelResult,
} from './ask-all.handler.spec.helper';
import { handleAsk } from '../../ask/domain-logic/ask.handler';
import type { McpTextContent, ResolvedProviderEntry } from '../../shared';
import type { AskAllToolArgs } from '../common';

vi.mock('../../ask/domain-logic/ask.handler', () => ({ handleAsk: vi.fn() }));

describe('handleAskAll', () => {
  let claude: ResolvedProviderEntry;
  let codex: ResolvedProviderEntry;
  let gemini: ResolvedProviderEntry;

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    claude = makeProvider('claude');
    codex = makeProvider('codex');
    gemini = makeProvider('gemini');
  });

  describe('provider filtering', () => {
    it('GIVEN no providers filter WHEN called THEN queries all resolved providers', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello' };

      await handleAskAll([claude, codex], args);

      expect(handleAsk).toHaveBeenCalledTimes(2);
    });

    it('GIVEN providers filter WHEN called THEN queries only matching providers', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello', providers: ['claude'] };

      await handleAskAll([claude, codex], args);

      expect(handleAsk).toHaveBeenCalledTimes(1);
      expect(handleAsk).toHaveBeenCalledWith(claude, expect.anything(), expect.anything());
    });

    it('GIVEN providers filter with unknown name WHEN called THEN skips unknown providers', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello', providers: ['claude', 'unknown'] };

      await handleAskAll([claude, codex], args);

      expect(handleAsk).toHaveBeenCalledTimes(1);
    });

    it('GIVEN provider-like text in the model field WHEN called THEN it keeps the shared model', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello', model: 'gemini,codex' };

      await handleAskAll([claude, codex, gemini], args);

      expect(handleAsk).toHaveBeenCalledTimes(3);
      expect(handleAsk).toHaveBeenCalledWith(
        claude,
        expect.objectContaining({ model: 'gemini,codex' }),
        expect.anything()
      );
      expect(handleAsk).toHaveBeenCalledWith(
        codex,
        expect.objectContaining({ model: 'gemini,codex' }),
        expect.anything()
      );
      expect(handleAsk).toHaveBeenCalledWith(
        gemini,
        expect.objectContaining({ model: 'gemini,codex' }),
        expect.anything()
      );
    });

    it('GIVEN whitespace-separated shared model text that is not provider names WHEN called THEN it keeps the shared model', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello', model: 'claude sonnet 4' };

      await handleAskAll([claude], args);

      expect(handleAsk).toHaveBeenCalledWith(
        claude,
        expect.objectContaining({ model: 'claude sonnet 4' }),
        expect.anything()
      );
    });

    it('GIVEN explicit providers and provider-like model text WHEN called THEN providers stay explicit and model stays shared', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = {
        prompt: 'hello',
        providers: ['claude', 'codex'],
        model: 'gemini,codex',
      };

      await handleAskAll([claude, codex, gemini], args);

      expect(handleAsk).toHaveBeenCalledTimes(2);
      expect(handleAsk).toHaveBeenCalledWith(
        claude,
        expect.objectContaining({ model: 'gemini,codex' }),
        expect.anything()
      );
      expect(handleAsk).toHaveBeenCalledWith(
        codex,
        expect.objectContaining({ model: 'gemini,codex' }),
        expect.anything()
      );
      expect(handleAsk).not.toHaveBeenCalledWith(gemini, expect.anything(), expect.anything());
    });

    it('GIVEN providers filter that matches nothing WHEN called THEN returns isError result', async () => {
      const args: AskAllToolArgs = { prompt: 'hello', providers: ['unknown'] };

      const result = await handleAskAll([claude, codex], args);

      expect(result.isError).toBe(true);
      expect((result.content[0] as McpTextContent).text).toContain('No matching providers');
    });

    it('GIVEN empty resolved providers WHEN called THEN returns isError result', async () => {
      const args: AskAllToolArgs = { prompt: 'hello' };

      const result = await handleAskAll([], args);

      expect(result.isError).toBe(true);
    });
  });

  describe('result aggregation', () => {
    it('GIVEN all providers succeed WHEN called THEN succeeded count equals total', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('response text'));

      const args: AskAllToolArgs = { prompt: 'hello' };
      const result = await handleAskAll([claude, codex], args);

      const parsed = parseResult(result);

      expect(parsed.succeeded).toBe(2);
      expect(parsed.failed).toBe(0);
      expect(parsed.totalProviders).toBe(2);
    });

    it('GIVEN all providers fail WHEN called THEN isError is true', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeErrorResult('provider error'));

      const args: AskAllToolArgs = { prompt: 'hello' };
      const result = await handleAskAll([claude, codex], args);

      expect(result.isError).toBe(true);
      const parsed = parseResult(result);

      expect(parsed.failed).toBe(2);
      expect(parsed.succeeded).toBe(0);
    });

    it('GIVEN some providers fail WHEN called THEN isError is false', async () => {
      vi.mocked(handleAsk)
        .mockResolvedValueOnce(makeSuccessResult('ok'))
        .mockResolvedValueOnce(makeErrorResult('failed'));

      const args: AskAllToolArgs = { prompt: 'hello' };
      const result = await handleAskAll([claude, codex], args);

      expect(result.isError).toBeFalsy();
      const parsed = parseResult(result);

      expect(parsed.succeeded).toBe(1);
      expect(parsed.failed).toBe(1);
    });

    it('GIVEN a provider throws WHEN called THEN that provider is counted as failed', async () => {
      vi.mocked(handleAsk)
        .mockResolvedValueOnce(makeSuccessResult('ok'))
        .mockRejectedValueOnce(new Error('network error'));

      const args: AskAllToolArgs = { prompt: 'hello' };
      const result = await handleAskAll([claude, codex], args);

      expect(result.isError).toBeFalsy();
      const parsed = parseResult(result);

      expect(parsed.succeeded).toBe(1);
      expect(parsed.failed).toBe(1);
      expect(parsed.results[1]?.error).toBe('network error');
    });

    it('GIVEN a provider hangs WHEN called THEN it uses that provider ask timeout', async () => {
      vi.useFakeTimers();

      const slowGemini = makeProvider('gemini', { timeout: 30_000 });

      vi.mocked(handleAsk).mockImplementation(async (provider) => {
        if (provider.name === 'codex') return makeSuccessResult('ok');

        if (provider.name === 'gemini') return new Promise<CallToolResult>(() => {});

        throw new Error(`Unexpected call for ${provider.name}`);
      });

      const resultPromise = handleAskAll([codex, slowGemini], { prompt: 'hello' });

      await vi.advanceTimersByTimeAsync(30_000);

      const result = await resultPromise;
      const parsed = parseResult(result);

      expect(parsed.succeeded).toBe(1);
      expect(parsed.failed).toBe(1);
      expect(parsed.results[1]?.error).toContain('timed out after 30000ms');
    });

    it('GIVEN providers succeed WHEN called THEN results contain response text', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('the answer'));

      const args: AskAllToolArgs = { prompt: 'hello' };
      const result = await handleAskAll([claude], args);

      const parsed = parseResult(result);
      const firstResult = parsed.results[0];

      if (!firstResult) {
        throw new Error('Expected first result to be defined');
      }

      expect(firstResult.response).toBe('the answer');
      expect(firstResult.success).toBe(true);
      expect(firstResult.provider).toBe('claude');
    });

    it('GIVEN providers fail WHEN called THEN results contain error text', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeErrorResult('something went wrong'));

      const args: AskAllToolArgs = { prompt: 'hello' };
      const result = await handleAskAll([claude], args);

      const parsed = parseResult(result);

      expect(parsed.results[0]?.error).toBe('something went wrong');
      expect(parsed.results[0]?.success).toBe(false);
    });

    it('GIVEN call WHEN called THEN result contains prompt', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'my question' };
      const result = await handleAskAll([claude], args);

      const parsed = parseResult(result);

      expect(parsed.prompt).toBe('my question');
    });

    it('GIVEN call WHEN called THEN result contains executionTimeMs', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello' };
      const result = await handleAskAll([claude], args);

      const parsed = parseResult(result);

      expect(typeof parsed.totalExecutionTimeMs).toBe('number');
      expect(parsed.totalExecutionTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof parsed.results[0]?.executionTimeMs).toBe('number');
    });

    it('GIVEN mixed provider outcomes WHEN called THEN text content summarizes the comparison', async () => {
      vi.mocked(handleAsk)
        .mockResolvedValueOnce(makeSuccessResult('ok'))
        .mockResolvedValueOnce(makeErrorResult('failed'));

      const args: AskAllToolArgs = { prompt: 'hello' };
      const result = await handleAskAll([claude, codex], args);
      const summaryText = (result.content[0] as McpTextContent).text;

      expect(summaryText).toContain('Comparison complete for 2 providers');
      expect(summaryText).toContain('Succeeded: 1');
      expect(summaryText).toContain('Failed: 1');
      expect(summaryText).toContain('- claude: success');
      expect(summaryText).toContain('- codex: failed');
    });
  });

  describe('arg forwarding', () => {
    it('GIVEN model arg WHEN called THEN forwards model to handleAsk', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello', model: 'gpt-4' };

      await handleAskAll([claude], args);

      expect(handleAsk).toHaveBeenCalledWith(claude, expect.objectContaining({ model: 'gpt-4' }), expect.anything());
    });

    it('GIVEN explicit shared model fails for one provider WHEN called THEN it returns the provider model error without retrying', async () => {
      vi.mocked(handleAsk).mockImplementation(async (provider, askArgs) => {
        const result = await Promise.resolve(resolveExplicitModelResult(provider.name, askArgs.model));

        return result;
      });
      const args: AskAllToolArgs = {
        prompt: 'hello',
        providers: ['codex', 'gemini'],
        model: EXPLICIT_SHARED_MODEL,
      };
      const result = await handleAskAll([claude, codex, gemini], args);
      const parsed = parseResult(result);

      expect(parsed.succeeded).toBe(1);
      expect(parsed.failed).toBe(1);
      expect(handleAsk).toHaveBeenCalledTimes(2);
      expect(handleAsk).toHaveBeenCalledWith(
        gemini,
        expect.objectContaining({ model: EXPLICIT_SHARED_MODEL }),
        expect.anything()
      );
      expect(handleAsk).not.toHaveBeenCalledWith(
        gemini,
        expect.not.objectContaining({ model: EXPLICIT_SHARED_MODEL }),
        expect.anything()
      );
      expect(parsed.results[1]?.error).toContain('ModelNotFoundError');
    });

    it('GIVEN context arg WHEN called THEN forwards context to handleAsk', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello', context: 'some context' };

      await handleAskAll([claude], args);

      expect(handleAsk).toHaveBeenCalledWith(
        claude,
        expect.objectContaining({ context: 'some context' }),
        expect.anything()
      );
    });

    it('GIVEN working_directory arg WHEN called THEN forwards working_directory to handleAsk', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello', working_directory: '/some/dir' };

      await handleAskAll([claude], args);

      expect(handleAsk).toHaveBeenCalledWith(
        claude,
        expect.objectContaining({ working_directory: '/some/dir' }),
        expect.anything()
      );
    });

    it('GIVEN system_prompt arg WHEN called THEN forwards system_prompt to handleAsk', async () => {
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      const args: AskAllToolArgs = { prompt: 'hello', system_prompt: 'be concise' };

      await handleAskAll([claude], args);

      expect(handleAsk).toHaveBeenCalledWith(
        claude,
        expect.objectContaining({ system_prompt: 'be concise' }),
        expect.anything()
      );
    });

    it('GIVEN three providers WHEN called THEN runs all in parallel via allSettled', async () => {
      const order: string[] = [];

      vi.mocked(handleAsk).mockImplementation(async (provider) => {
        order.push(provider.name);

        return Promise.resolve(makeSuccessResult('ok'));
      });

      const args: AskAllToolArgs = { prompt: 'hello' };

      await handleAskAll([claude, codex, gemini], args);

      expect(handleAsk).toHaveBeenCalledTimes(3);
      expect(order).toHaveLength(3);
    });
  });
});
