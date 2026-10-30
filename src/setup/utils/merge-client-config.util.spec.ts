import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMergedClientConfig } from './merge-client-config.util';
import type { McpServerEntry } from '../common';

const AGENTIC_SERVER_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

const AGENTIC_ONLY_SERVERS = { 'agentic-mcp': AGENTIC_SERVER_ENTRY };

const AGENTIC_ONLY_CONFIG = { mcpServers: AGENTIC_ONLY_SERVERS };

describe('buildMergedClientConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('GIVEN no existing config WHEN merging THEN returns created status with agentic entry only', () => {
    const result = buildMergedClientConfig({
      existingConfigText: undefined,
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
    });

    expect(result.status).toBe('created');
    expect(result.mergedConfig).toStrictEqual(AGENTIC_ONLY_CONFIG);
  });

  it('GIVEN a whitespace-only existing config WHEN merging THEN returns created status, not invalid-json', () => {
    const result = buildMergedClientConfig({
      existingConfigText: '  \n',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
    });

    expect(result.status).toBe('created');
    expect(result.mergedConfig).toStrictEqual(AGENTIC_ONLY_CONFIG);
  });

  it('GIVEN valid existing config WHEN merging THEN returns merged status and preserves unrelated keys', () => {
    const existing = { command: 'node', args: ['server.js'] };
    const existingServers = { existing };
    const existingConfig = { version: 1, mcpServers: existingServers };
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(existingConfig, null, 2),
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
    });
    const expectedServers = { existing, 'agentic-mcp': AGENTIC_SERVER_ENTRY };

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({ version: 1, mcpServers: expectedServers });
  });

  it('GIVEN matching agentic entry WHEN merging THEN returns unchanged status', () => {
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(AGENTIC_ONLY_CONFIG),
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
    });

    expect(result.status).toBe('unchanged');
    expect(result.mergedConfig).toStrictEqual(AGENTIC_ONLY_CONFIG);
  });

  it('GIVEN invalid JSON WHEN merging THEN returns invalid-json status', () => {
    const result = buildMergedClientConfig({
      existingConfigText: '{ bad json',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
    });

    expect(result.status).toBe('invalid-json');
    expect(result.reason).toContain('Invalid JSON');
  });

  it('GIVEN existing root keys and servers WHEN merging THEN preserves unrelated entries', () => {
    const metadata = { owner: 'team' };
    const alpha = { command: 'python', args: ['-m', 'alpha_server'] };
    const beta = { command: 'node', args: ['beta.js'] };
    const existingServers = { alpha, beta };
    const existingConfig = {
      $schema: 'https://example.com/schema.json',
      metadata,
      mcpServers: existingServers,
    };
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
    });
    const expectedServers = { alpha, beta, 'agentic-mcp': AGENTIC_SERVER_ENTRY };

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({
      $schema: 'https://example.com/schema.json',
      metadata,
      mcpServers: expectedServers,
    });
  });
  it('GIVEN existing mcpServers is not an object WHEN merging THEN replaces it with the agentic server entry', () => {
    const existingConfig = { version: 1, mcpServers: ['invalid-shape'] };
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
    });

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({ version: 1, mcpServers: AGENTIC_ONLY_SERVERS });
  });

  it('GIVEN parsed JSON is not an object WHEN merging THEN creates a config with only the agentic server entry', () => {
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(['not-an-object']),
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
    });

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual(AGENTIC_ONLY_CONFIG);
  });

  it('GIVEN JSON parse throws a non-Error value WHEN merging THEN returns invalid-json with the fallback reason', () => {
    vi.spyOn(JSON, 'parse').mockImplementation(() => {
      const nonError = 'bad parse' as unknown as Error;

      throw nonError;
    });

    const result = buildMergedClientConfig({
      existingConfigText: '{ still bad json',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
    });

    expect(result.status).toBe('invalid-json');
    expect(result.reason).toBe('Invalid JSON');
  });
});
