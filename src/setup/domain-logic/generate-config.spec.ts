import { describe, expect, it } from 'vitest';

import { generateClientConfigEntry } from './generate-config';
import type { DetectedProvider, SupportedClient } from '../common';

const makeProvider = (name: string, available: boolean, binaryPath?: string): DetectedProvider => {
  const provider: DetectedProvider = {
    name,
    available,
    binaryPath,
  };

  return provider;
};

describe('generateClientConfigEntry', () => {
  it('GIVEN claude-code WHEN generating entry THEN the per-server timeout is one minute above the provider timeout', () => {
    const result = generateClientConfigEntry('claude-code', []);

    expect(result).toStrictEqual({
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
      timeout: 3_660_000,
    });
  });

  it('GIVEN cursor WHEN generating entry THEN no timeout key is written', () => {
    const result = generateClientConfigEntry('cursor', []);

    expect(result).toStrictEqual({
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
    });
  });

  it('GIVEN generic client and provider detection WHEN generating entry THEN output stays stable', () => {
    const providers = [makeProvider('claude', true, '/usr/bin/claude')];

    const result = generateClientConfigEntry('generic', providers);

    expect(result.command).toBe('npx');
    expect(result.args).toStrictEqual(['-y', 'agentic-mcp']);
  });

  it('GIVEN generic client and no detected providers WHEN generating entry THEN output stays stable', () => {
    const result = generateClientConfigEntry('generic', []);

    expect(result.command).toBe('npx');
    expect(result.args).toStrictEqual(['-y', 'agentic-mcp']);
  });

  it('GIVEN available providers and unavailable providers WHEN generating entry THEN does not leak binary paths', () => {
    const providers = [makeProvider('claude', true, '/usr/bin/claude'), makeProvider('codex', false)];

    const result = generateClientConfigEntry('windsurf', providers);

    expect(result.command).toBe('npx');
    expect(result.args).toStrictEqual(['-y', 'agentic-mcp']);
  });

  it('GIVEN unknown client WHEN generating entry THEN default branch returns deterministic entry', () => {
    const unknownClient = 'future-client' as SupportedClient;

    const result = generateClientConfigEntry(unknownClient, []);

    expect(result.command).toBe('npx');
    expect(result.args).toStrictEqual(['-y', 'agentic-mcp']);
  });

  it('GIVEN gemini WHEN generating entry THEN the timeout in ms is one minute above the provider timeout', () => {
    const result = generateClientConfigEntry('gemini', []);

    expect(result).toStrictEqual({
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
      timeout: 3_660_000,
    });
  });

  it('GIVEN copilot WHEN generating entry THEN it is a local server with all tools and the timeout in ms', () => {
    const result = generateClientConfigEntry('copilot', []);

    expect(result).toStrictEqual({
      type: 'local',
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
      tools: ['*'],
      timeout: 3_660_000,
    });
  });
});
