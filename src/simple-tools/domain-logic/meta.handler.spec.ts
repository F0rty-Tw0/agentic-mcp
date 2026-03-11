import { describe, expect, it } from 'vitest';

import { handleListProviders } from './meta.handler';
import type { McpPlainTextContent, ResolvedProvider } from '../../shared';

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
    it('GIVEN detected provider WHEN listing THEN shows "binary detected" status', () => {
      const providers = [createProvider({ available: true, enabled: true })];

      const result = handleListProviders(providers);

      expect((result.content[0] as McpPlainTextContent).text).toContain('[binary detected]');
    });

    it('GIVEN enabled but missing provider WHEN listing THEN shows "binary missing" status', () => {
      const providers = [createProvider({ enabled: true, available: false, binaryPath: undefined })];

      const result = handleListProviders(providers);

      expect((result.content[0] as McpPlainTextContent).text).toContain('[binary missing]');
    });

    it('GIVEN disabled provider WHEN listing THEN shows "disabled" status', () => {
      const providers = [createProvider({ enabled: false, available: false, binaryPath: undefined })];

      const result = handleListProviders(providers);

      expect((result.content[0] as McpPlainTextContent).text).toContain('[disabled]');
    });
  });

  describe('output formatting', () => {
    it('GIVEN one detected provider WHEN listing THEN adds the next proof step', () => {
      const providers = [createProvider({ name: 'claude', description: 'Anthropic Claude' })];

      const result = handleListProviders(providers);

      expect(result).toStrictEqual({
        content: [
          {
            type: 'text',
            text:
              'Configured providers:\n' +
              '- claude: Anthropic Claude [binary detected]\n' +
              'Next: run ask_claude to prove authentication and a real response.',
          },
        ],
      });
    });

    it('GIVEN mixed providers WHEN listing THEN shows truthful labels and one next step', () => {
      const providers = [
        createProvider({ name: 'claude', description: 'Anthropic Claude' }),
        createProvider({ name: 'codex', description: 'OpenAI Codex', enabled: true, available: false }),
        createProvider({ name: 'gemini', description: 'Google Gemini', enabled: false, available: false }),
      ];

      const result = handleListProviders(providers);

      const text = (result.content[0] as McpPlainTextContent).text;

      expect(text).toBe(
        'Configured providers:\n' +
          '- claude: Anthropic Claude [binary detected]\n' +
          '- codex: OpenAI Codex [binary missing]\n' +
          '- gemini: Google Gemini [disabled]\n' +
          'Next: run ask_claude to prove authentication and a real response.'
      );
    });

    it('GIVEN no detected providers WHEN listing THEN explains the next recovery step', () => {
      const result = handleListProviders([]);

      expect(result).toStrictEqual({
        content: [
          {
            type: 'text',
            text:
              'Configured providers:\n' +
              'Next: install and authenticate a supported provider CLI, then rerun list_providers.',
          },
        ],
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
