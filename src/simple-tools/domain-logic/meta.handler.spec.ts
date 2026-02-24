import { describe, expect, it } from 'vitest';

import { handleListProviders } from './meta.handler';
import type { ResolvedProvider } from "../../shared/common";

const createProvider = (overrides: Partial<ResolvedProvider> = {}): ResolvedProvider => ({
  name: 'test-provider',
  description: 'A test provider',
  enabled: true,
  available: true,
  binaryPath: '/usr/bin/test-cli',
  ...overrides,
});

describe('handleListProviders', () => {
  describe('provider status labels', () => {
    it('GIVEN available provider WHEN listing THEN shows "available" status', () => {
      const providers = [createProvider({ available: true, enabled: true })];

      const result = handleListProviders(providers);

      expect((result.content[0] as { text: string }).text).toContain('[available]');
    });

    it('GIVEN enabled but unavailable provider WHEN listing THEN shows "not found" status', () => {
      const providers = [createProvider({ enabled: true, available: false, binaryPath: null })];

      const result = handleListProviders(providers);

      expect((result.content[0] as { text: string }).text).toContain('[not found]');
    });

    it('GIVEN disabled provider WHEN listing THEN shows "disabled" status', () => {
      const providers = [createProvider({ enabled: false, available: false, binaryPath: null })];

      const result = handleListProviders(providers);

      expect((result.content[0] as { text: string }).text).toContain('[disabled]');
    });
  });

  describe('output formatting', () => {
    it('GIVEN single provider WHEN listing THEN returns formatted line with name and description', () => {
      const providers = [createProvider({ name: 'claude', description: 'Anthropic Claude' })];

      const result = handleListProviders(providers);

      expect(result).toStrictEqual({
        content: [
          {
            type: 'text',
            text: 'Configured providers:\n- claude: Anthropic Claude [available]',
          },
        ],
      });
    });

    it('GIVEN multiple providers WHEN listing THEN returns one line per provider', () => {
      const providers = [
        createProvider({ name: 'claude', description: 'Anthropic Claude' }),
        createProvider({ name: 'codex', description: 'OpenAI Codex', enabled: true, available: false }),
        createProvider({ name: 'gemini', description: 'Google Gemini', enabled: false, available: false }),
      ];

      const result = handleListProviders(providers);

      const text = (result.content[0] as { text: string }).text;

      expect(text).toBe(
        'Configured providers:\n' +
          '- claude: Anthropic Claude [available]\n' +
          '- codex: OpenAI Codex [not found]\n' +
          '- gemini: Google Gemini [disabled]'
      );
    });

    it('GIVEN empty providers array WHEN listing THEN returns header only', () => {
      const result = handleListProviders([]);

      expect(result).toStrictEqual({
        content: [{ type: 'text', text: 'Configured providers:\n' }],
      });
    });
  });

  describe('result shape', () => {
    it('GIVEN providers WHEN listing THEN returns CallToolResult with single text content', () => {
      const result = handleListProviders([createProvider()]);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
    });

    it('GIVEN providers WHEN listing THEN does not set isError', () => {
      const result = handleListProviders([createProvider()]);

      expect(result.isError).toBeUndefined();
    });
  });
});
