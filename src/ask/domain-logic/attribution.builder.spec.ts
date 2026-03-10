import { describe, expect, it } from 'vitest';

import { buildAttribution } from './attribution.builder';
import type { ProviderAttribution } from '../common';

describe('buildAttribution', () => {
  const BASE_RESULT = {
    executionTimeMs: 1500,
    truncated: false,
    stdoutBytes: 256,
    stdout: 'some output',
    stderr: '',
    exitCode: 0,
    signal: null,
    timedOut: false,
    stderrBytes: 0,
  } as const;

  describe('provider field', () => {
    it('GIVEN provider name "claude" WHEN buildAttribution called THEN provider is "claude"', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.provider).toBe('claude');
    });

    it('GIVEN provider name "codex" WHEN buildAttribution called THEN provider is "codex"', () => {
      const result = buildAttribution({
        provider: 'codex',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.provider).toBe('codex');
    });
  });

  describe('model field', () => {
    it('GIVEN model "gpt-4" WHEN buildAttribution called THEN model is "gpt-4"', () => {
      const result = buildAttribution({
        provider: 'codex',
        model: 'gpt-4',
        result: BASE_RESULT,
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.model).toBe('gpt-4');
    });

    it('GIVEN no model WHEN buildAttribution called THEN model is undefined', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.model).toBeUndefined();
    });
  });

  describe('executionTimeMs field', () => {
    it('GIVEN executionTimeMs 1500 WHEN buildAttribution called THEN executionTimeMs is 1500', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: { ...BASE_RESULT, executionTimeMs: 1500 },
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.executionTimeMs).toBe(1500);
    });

    it('GIVEN executionTimeMs 0 WHEN buildAttribution called THEN executionTimeMs is 0', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: { ...BASE_RESULT, executionTimeMs: 0 },
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.executionTimeMs).toBe(0);
    });
  });

  describe('outputBytes field', () => {
    it('GIVEN stdoutBytes 256 WHEN buildAttribution called THEN outputBytes is 256', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: { ...BASE_RESULT, stdoutBytes: 256 },
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.outputBytes).toBe(256);
    });
  });

  describe('truncated field', () => {
    it('GIVEN truncated false WHEN buildAttribution called THEN truncated is false', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: { ...BASE_RESULT, truncated: false },
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.truncated).toBe(false);
    });

    it('GIVEN truncated true WHEN buildAttribution called THEN truncated is true', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: { ...BASE_RESULT, truncated: true },
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.truncated).toBe(true);
    });
  });

  describe('outputFormat field', () => {
    it('GIVEN outputFormat "json" WHEN buildAttribution called THEN outputFormat is "json"', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'json',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.outputFormat).toBe('json');
    });

    it('GIVEN outputFormat "stream-json" WHEN buildAttribution called THEN outputFormat is "stream-json"', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'stream-json',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.outputFormat).toBe('stream-json');
    });

    it('GIVEN outputFormat "text" WHEN buildAttribution called THEN outputFormat is "text"', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.outputFormat).toBe('text');
    });
  });

  describe('sessionMode field', () => {
    it('GIVEN sessionMode "none" WHEN buildAttribution called THEN sessionMode is undefined', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.sessionMode).toBeUndefined();
    });

    it('GIVEN sessionMode "tier1-prepend" WHEN buildAttribution called THEN sessionMode is "tier1-prepend"', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'tier1-prepend',
      });

      expect(result.sessionMode).toBe('tier1-prepend');
    });

    it('GIVEN sessionMode "tier2-native" WHEN buildAttribution called THEN sessionMode is "tier2-native"', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'tier2-native',
      });

      expect(result.sessionMode).toBe('tier2-native');
    });
  });

  describe('outputFormatObserved field', () => {
    it('GIVEN metadata with outputFormatObserved "json" WHEN buildAttribution called THEN outputFormatObserved is "json"', () => {
      const metadata = { outputFormatObserved: 'json' as const };
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'json',
        metadata,
        sessionMode: 'none',
      });

      expect(result.outputFormatObserved).toBe('json');
    });

    it('GIVEN no metadata WHEN buildAttribution called THEN outputFormatObserved is undefined', () => {
      const result = buildAttribution({
        provider: 'claude',
        model: undefined,
        result: BASE_RESULT,
        outputFormat: 'text',
        metadata: undefined,
        sessionMode: 'none',
      });

      expect(result.outputFormatObserved).toBeUndefined();
    });
  });

  describe('full attribution shape', () => {
    it('GIVEN all fields WHEN buildAttribution called THEN returns complete ProviderAttribution', () => {
      const metadata = { outputFormatObserved: 'stream-json' as const };
      const result = buildAttribution({
        provider: 'gemini',
        model: 'gemini-pro',
        result: { ...BASE_RESULT, executionTimeMs: 2000, stdoutBytes: 512, truncated: true },
        outputFormat: 'stream-json',
        metadata,
        sessionMode: 'tier1-prepend',
      });

      const expected: ProviderAttribution = {
        provider: 'gemini',
        model: 'gemini-pro',
        executionTimeMs: 2000,
        outputBytes: 512,
        truncated: true,
        outputFormat: 'stream-json',
        sessionMode: 'tier1-prepend',
        outputFormatObserved: 'stream-json',
      };

      expect(result).toStrictEqual(expected);
    });
  });
});
