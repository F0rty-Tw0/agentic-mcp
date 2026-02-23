import { describe, expect, it } from 'vitest';

import { generateClientConfig } from './generate-config.ts';
import type { DetectedProvider } from '../common/index.ts';

const makeProvider = (name: string, available: boolean, binaryPath: string | null = null): DetectedProvider => ({
  name,
  available,
  binaryPath,
});

describe('generateClientConfig', () => {
  describe('config structure', () => {
    it('GIVEN any client and providers WHEN generating config THEN returns valid JSON with mcpServers key', () => {
      const result = generateClientConfig('claude-code', []);
      const parsed = JSON.parse(result) as { mcpServers: unknown };

      expect(parsed).toHaveProperty('mcpServers');
    });

    it('GIVEN claude-code client WHEN generating config THEN contains agentic-mcp server entry', () => {
      const result = generateClientConfig('claude-code', []);
      const parsed = JSON.parse(result) as {
        mcpServers: Record<string, { command: string; args: string[] }>;
      };

      expect(parsed.mcpServers['agentic-mcp']).toStrictEqual({
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      });
    });

    it('GIVEN cursor client WHEN generating config THEN contains agentic-mcp server entry', () => {
      const result = generateClientConfig('cursor', []);
      const parsed = JSON.parse(result) as {
        mcpServers: Record<string, { command: string; args: string[] }>;
      };

      expect(parsed.mcpServers['agentic-mcp']).toStrictEqual({
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      });
    });

    it('GIVEN generic client WHEN generating config THEN still returns valid config JSON', () => {
      const providers = [makeProvider('claude', true, '/usr/bin/claude')];
      const result = generateClientConfig('generic', providers);
      const parsed = JSON.parse(result) as { mcpServers: unknown };

      expect(parsed).toHaveProperty('mcpServers');
    });
  });

  describe('config formatting', () => {
    it('GIVEN any client WHEN generating config THEN output is pretty-printed JSON', () => {
      const result = generateClientConfig('claude-code', []);

      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });
  });

  describe('provider detection independence', () => {
    it('GIVEN no available providers WHEN generating config THEN config still points to npx agentic-mcp', () => {
      const providers = [
        makeProvider('claude', false),
        makeProvider('codex', false),
      ];

      const result = generateClientConfig('claude-code', providers);
      const parsed = JSON.parse(result) as {
        mcpServers: Record<string, { command: string; args: string[] }>;
      };

      expect(parsed.mcpServers['agentic-mcp']?.command).toBe('npx');
    });

    it('GIVEN some available providers WHEN generating config THEN config always uses npx not binary paths', () => {
      const providers = [
        makeProvider('claude', true, '/usr/bin/claude'),
        makeProvider('codex', false),
      ];

      const result = generateClientConfig('windsurf', providers);
      const parsed = JSON.parse(result) as {
        mcpServers: Record<string, { command: string }>;
      };

      expect(parsed.mcpServers['agentic-mcp']?.command).toBe('npx');
    });
  });
});
