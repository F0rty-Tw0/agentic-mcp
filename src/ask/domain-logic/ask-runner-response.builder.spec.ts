import { describe, expect, it, vi } from 'vitest';

import { resolveModelHint } from './ask-command';
import { buildSuccessfulResponse } from './ask-runner-response.builder';
import { buildAttribution } from './attribution.builder';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared';
import { TEST_PROVIDER_CONFIG_STUB } from '../../shared/provider/test/stubs/provider-config.stub';
import type { ProviderOutputMetadata, SuccessResponseInput } from '../common';
import { buildCappedOutput, parseProviderOutput } from '../utils';

vi.mock('./ask-command', () => {
  const result = {
    resolveModelHint: vi.fn(() => ''),
  };

  return result;
});

vi.mock('./attribution.builder', () => {
  const result = {
    buildAttribution: vi.fn(() => {
      const attribution = { provider: 'test-provider' };

      return attribution;
    }),
  };

  return result;
});

vi.mock('../utils', () => {
  const result = {
    buildCappedOutput: vi.fn((s: string) => s),
    parseProviderOutput: vi.fn((stdout: string) => {
      const parsedOutput = { text: stdout };

      return parsedOutput;
    }),
  };

  return result;
});

const stubContext = (overrides?: Partial<ResolvedProviderEntry>): ResolvedProviderEntry => {
  const result: ResolvedProviderEntry = {
    name: 'test-provider',
    binaryPath: '/usr/bin/test',
    config: TEST_PROVIDER_CONFIG_STUB,
    ...overrides,
  };

  return result;
};

const stubStreamNotifier = (): SuccessResponseInput['streamNotifier'] => {
  const result: SuccessResponseInput['streamNotifier'] = {
    onStdoutChunk: vi.fn(),
    onStderrChunk: vi.fn(),
    emitStart: vi.fn(),
    emitDone: vi.fn(),
    emitError: vi.fn(),
    stop: vi.fn(),
    enabled: false,
  };

  return result;
};

const stubSummary = (): SuccessResponseInput['summary'] => {
  return {
    executionTimeMs: 1500,
    truncated: false,
    stdoutBytes: 100,
  } as unknown as SuccessResponseInput['summary'];
};

const buildInput = (overrides?: Partial<SuccessResponseInput>): SuccessResponseInput => {
  const args = { prompt: 'test prompt' };
  const result: SuccessResponseInput = {
    context: stubContext(),
    args,
    env: {},
    stdout: 'hello world',
    stderr: '',
    executionTimeMs: 1500,
    truncated: false,
    stdoutBytes: 100,
    outputFormat: 'json',
    streamNotifier: stubStreamNotifier(),
    summary: stubSummary(),
    sessionMode: 'none',
    ...overrides,
  };

  return result;
};

describe('buildSuccessfulResponse', () => {
  describe('success path (no model hint)', () => {
    it('GIVEN include_structured is omitted WHEN building THEN returns only surfaced response text', async () => {
      const input = buildInput({ stdout: 'provider output' });

      const result = await buildSuccessfulResponse(input);

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toStrictEqual({ type: 'text', text: 'provider output' });
      expect(result.structuredContent).toBeUndefined();
    });

    it('GIVEN include_structured is true WHEN building THEN returns response metadata in structuredContent', async () => {
      const args = { prompt: 'test prompt', include_structured: true };
      const input = buildInput({ args });

      const result = await buildSuccessfulResponse(input);

      const attribution = { provider: 'test-provider' };

      expect(result.structuredContent).toStrictEqual({
        response: 'hello world',
        attribution,
      });
    });

    it('GIVEN normal output WHEN building THEN calls emitDone on streamNotifier', async () => {
      const notifier = stubStreamNotifier();
      const summary = stubSummary();
      const input = buildInput({ streamNotifier: notifier, summary });

      await buildSuccessfulResponse(input);

      expect(notifier.emitDone).toHaveBeenCalledWith(summary);
    });

    it('GIVEN normal output WHEN building THEN does not call emitError', async () => {
      const notifier = stubStreamNotifier();
      const input = buildInput({ streamNotifier: notifier });

      await buildSuccessfulResponse(input);

      expect(notifier.emitError).not.toHaveBeenCalled();
    });

    it('GIVEN empty output WHEN building THEN falls back to "(no output)"', async () => {
      vi.mocked(buildCappedOutput).mockReturnValueOnce('');
      const input = buildInput({ stdout: '' });

      const result = await buildSuccessfulResponse(input);

      expect(result.content[0]).toStrictEqual({ type: 'text', text: '(no output)' });
    });
  });

  describe('model hint error path', () => {
    it('GIVEN resolveModelHint returns a hint WHEN building THEN returns isError true', async () => {
      vi.mocked(resolveModelHint).mockResolvedValueOnce('\nModel not found');
      const input = buildInput();

      const result = await buildSuccessfulResponse(input);

      expect(result.isError).toBe(true);
    });

    it('GIVEN resolveModelHint returns a hint WHEN building THEN content includes hint appended to text', async () => {
      vi.mocked(resolveModelHint).mockResolvedValueOnce('\nModel not found');
      vi.mocked(parseProviderOutput).mockReturnValueOnce({ text: 'raw output' });
      const input = buildInput();

      const result = await buildSuccessfulResponse(input);

      expect(result.content).toStrictEqual([{ type: 'text', text: 'raw output\nModel not found' }]);
    });

    it('GIVEN resolveModelHint returns a hint WHEN building THEN calls emitError on streamNotifier', async () => {
      vi.mocked(resolveModelHint).mockResolvedValueOnce('\nModel error');
      const notifier = stubStreamNotifier();
      const summary = stubSummary();
      const input = buildInput({ streamNotifier: notifier, summary });

      await buildSuccessfulResponse(input);

      expect(notifier.emitError).toHaveBeenCalledWith('Model validation failed', summary);
    });

    it('GIVEN resolveModelHint returns a hint WHEN building THEN does not call emitDone', async () => {
      vi.mocked(resolveModelHint).mockResolvedValueOnce('\nModel error');
      const notifier = stubStreamNotifier();
      const input = buildInput({ streamNotifier: notifier });

      await buildSuccessfulResponse(input);

      expect(notifier.emitDone).not.toHaveBeenCalled();
    });
  });

  describe('delegation to dependencies', () => {
    it('GIVEN stdout and outputFormat WHEN building THEN calls parseProviderOutput with stdout and outputFormat', async () => {
      const config: ProviderConfig = { ...TEST_PROVIDER_CONFIG_STUB, outputFormat: 'stream-json' };
      const context = stubContext({ config });
      const input = buildInput({ stdout: 'raw data', context, outputFormat: 'stream-json' });

      await buildSuccessfulResponse(input);

      expect(parseProviderOutput).toHaveBeenCalledWith('raw data', 'stream-json');
    });

    it('GIVEN parsed output WHEN building THEN calls resolveModelHint with parsed text', async () => {
      vi.mocked(parseProviderOutput).mockReturnValueOnce({ text: 'parsed text' });
      const input = buildInput({ stderr: 'some error' });

      await buildSuccessfulResponse(input);

      expect(resolveModelHint).toHaveBeenCalledWith(
        expect.objectContaining({ stdout: 'parsed text', stderr: 'some error' })
      );
    });

    it('GIVEN execution details WHEN building THEN calls buildAttribution with correct input', async () => {
      const metadata: ProviderOutputMetadata = { outputFormatObserved: 'json' };

      vi.mocked(parseProviderOutput).mockReturnValueOnce({
        text: 'output',
        metadata,
      });
      const args = { prompt: 'test', model: 'gpt-4' };
      const input = buildInput({
        executionTimeMs: 2000,
        truncated: true,
        stdoutBytes: 512,
        sessionMode: 'tier1-prepend',
        args,
      });

      await buildSuccessfulResponse(input);

      const result = { executionTimeMs: 2000, truncated: true, stdoutBytes: 512 };
      const expectedMetadata = { outputFormatObserved: 'json' };

      expect(buildAttribution).toHaveBeenCalledWith({
        provider: 'test-provider',
        model: 'gpt-4',
        result,
        outputFormat: 'json',
        metadata: expectedMetadata,
        sessionMode: 'tier1-prepend',
      });
    });

    it('GIVEN parsed text WHEN building THEN passes it through buildCappedOutput', async () => {
      vi.mocked(parseProviderOutput).mockReturnValueOnce({ text: 'long output' });
      const input = buildInput();

      await buildSuccessfulResponse(input);

      expect(buildCappedOutput).toHaveBeenCalledWith('long output');
    });
  });
});
