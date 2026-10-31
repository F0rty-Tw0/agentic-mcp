import { describe, expect, it } from 'vitest';

import { generateClientConfigEntry } from './generate-config';
import { CLIENT_TOOL_TIMEOUT_MS } from '../common';
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
  it('GIVEN claude-code WHEN generating entry THEN no timeout key is written, so its longer default stays', () => {
    const result = generateClientConfigEntry('claude-code', [], CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
    });
  });

  it('GIVEN cursor WHEN generating entry THEN no timeout key is written', () => {
    const result = generateClientConfigEntry('cursor', [], CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
    });
  });

  it('GIVEN generic client and provider detection WHEN generating entry THEN output stays stable', () => {
    const providers = [makeProvider('claude', true, '/usr/bin/claude')];

    const result = generateClientConfigEntry('generic', providers, CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({ command: 'npx', args: ['-y', 'agentic-mcp'] });
  });

  it('GIVEN generic client and no detected providers WHEN generating entry THEN output stays stable', () => {
    const result = generateClientConfigEntry('generic', [], CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({ command: 'npx', args: ['-y', 'agentic-mcp'] });
  });

  it('GIVEN available providers and unavailable providers WHEN generating entry THEN does not leak binary paths', () => {
    const providers = [makeProvider('claude', true, '/usr/bin/claude'), makeProvider('codex', false)];

    const result = generateClientConfigEntry('windsurf', providers, CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({ command: 'npx', args: ['-y', 'agentic-mcp'] });
  });

  it('GIVEN unknown client WHEN generating entry THEN default branch returns deterministic entry', () => {
    const unknownClient = 'future-client' as SupportedClient;

    const result = generateClientConfigEntry(unknownClient, [], CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({ command: 'npx', args: ['-y', 'agentic-mcp'] });
  });

  it('GIVEN gemini WHEN generating entry THEN the timeout in ms is above the provider timeout plus queue wait', () => {
    const result = generateClientConfigEntry('gemini', [], CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
      timeout: 4_260_000,
    });
  });

  it('GIVEN copilot WHEN generating entry THEN it is a local server with all tools and the timeout in ms', () => {
    const result = generateClientConfigEntry('copilot', [], CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({
      type: 'local',
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
      tools: ['*'],
      timeout: 4_260_000,
    });
  });

  it('GIVEN opencode WHEN generating entry THEN it is an enabled local server with a command array and the timeout in ms', () => {
    const result = generateClientConfigEntry('opencode', [], CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({
      type: 'local',
      command: ['npx', '-y', 'agentic-mcp'],
      enabled: true,
      timeout: 4_260_000,
    });
  });

  it('GIVEN codex WHEN generating entry THEN the tool timeout is in seconds and startup gets 60 s for a cold npx', () => {
    const result = generateClientConfigEntry('codex', [], CLIENT_TOOL_TIMEOUT_MS);

    expect(result).toStrictEqual({
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
      tool_timeout_sec: 4260,
      startup_timeout_sec: 60,
    });
  });

  it('GIVEN a tool timeout from the providers config WHEN generating a gemini entry THEN that value is written in ms', () => {
    const result = generateClientConfigEntry('gemini', [], 6_660_000);

    expect(result).toStrictEqual({ command: 'npx', args: ['-y', 'agentic-mcp'], timeout: 6_660_000 });
  });

  it('GIVEN a tool timeout that is not whole seconds WHEN generating a codex entry THEN the seconds are rounded up', () => {
    const result = generateClientConfigEntry('codex', [], 6_660_500);

    expect(result).toStrictEqual({
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
      tool_timeout_sec: 6661,
      startup_timeout_sec: 60,
    });
  });
});
