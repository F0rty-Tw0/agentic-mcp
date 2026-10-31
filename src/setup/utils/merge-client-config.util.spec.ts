import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMergedClientConfig } from './merge-client-config.util';
import type { ClientTarget, McpServerEntry, TimeoutKeyRule } from '../common';

const AGENTIC_SERVER_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

const TIMEOUT_RULE: TimeoutKeyRule = { key: 'timeout' };

const MCP_SERVERS_TARGET: ClientTarget = {
  configPath: '.client.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [TIMEOUT_RULE],
  preservedKeys: [],
  configPathEnvRules: [],
};

const TIMED_SERVER_ENTRY: McpServerEntry = { ...AGENTIC_SERVER_ENTRY, timeout: 4_260_000 };

const AGENTIC_ONLY_SERVERS = { 'agentic-mcp': AGENTIC_SERVER_ENTRY };

const AGENTIC_ONLY_CONFIG = { mcpServers: AGENTIC_ONLY_SERVERS };

const REMOTE_URL_REASON =
  'the agentic-mcp entry uses url (a remote server) and setup writes a local command; it will not mix the two, so remove url or replace the entry by hand';

describe('buildMergedClientConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('GIVEN no existing config WHEN merging THEN returns created status with agentic entry only', () => {
    const result = buildMergedClientConfig({
      existingConfigText: undefined,
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
    });

    expect(result.status).toBe('created');
    expect(result.mergedConfig).toStrictEqual(AGENTIC_ONLY_CONFIG);
  });

  it('GIVEN a whitespace-only existing config WHEN merging THEN returns created status, not invalid-json', () => {
    const result = buildMergedClientConfig({
      existingConfigText: '  \n',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
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
      target: MCP_SERVERS_TARGET,
    });
    const expectedServers = { existing, 'agentic-mcp': AGENTIC_SERVER_ENTRY };

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({ version: 1, mcpServers: expectedServers });
  });

  it('GIVEN matching agentic entry WHEN merging THEN returns unchanged status', () => {
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(AGENTIC_ONLY_CONFIG),
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
    });

    expect(result.status).toBe('unchanged');
    expect(result.mergedConfig).toStrictEqual(AGENTIC_ONLY_CONFIG);
  });

  it('GIVEN invalid JSON WHEN merging THEN returns invalid-json status', () => {
    const result = buildMergedClientConfig({
      existingConfigText: '{ bad json',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
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
      target: MCP_SERVERS_TARGET,
    });
    const expectedServers = { alpha, beta, 'agentic-mcp': AGENTIC_SERVER_ENTRY };

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({
      $schema: 'https://example.com/schema.json',
      metadata,
      mcpServers: expectedServers,
    });
  });
  it('GIVEN existing mcpServers is not an object WHEN merging THEN it is unmergeable instead of replaced', () => {
    const existingConfig = { version: 1, mcpServers: ['invalid-shape'] };
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
    });

    expect(result.status).toBe('unmergeable');
    expect(result.reason).toBe(
      'mcpServers is not an object, and setup will not replace it; make it an object or remove it, then run setup again'
    );
  });

  it('GIVEN parsed JSON is not an object WHEN merging THEN it is unmergeable instead of replaced', () => {
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(['not-an-object']),
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
    });

    expect(result.status).toBe('unmergeable');
    expect(result.reason).toBe(
      'the config file is not a JSON object, and setup will not replace it; fix or remove the file, then run setup again'
    );
  });

  it('GIVEN JSON parse throws a non-Error value WHEN merging THEN returns invalid-json with the fallback reason', () => {
    vi.spyOn(JSON, 'parse').mockImplementation(() => {
      const nonError = 'bad parse' as unknown as Error;

      throw nonError;
    });

    const result = buildMergedClientConfig({
      existingConfigText: '{ still bad json',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
    });

    expect(result.status).toBe('invalid-json');
    expect(result.reason).toBe('Invalid JSON');
  });

  it('GIVEN a client whose servers live under another key WHEN merging THEN the entry is written under that key', () => {
    const target: ClientTarget = { ...MCP_SERVERS_TARGET, serversKey: 'mcp' };
    const other = { type: 'local', command: ['other'] };
    const existingServers = { other };
    const existingConfig = { $schema: 'https://opencode.ai/config.json', mcp: existingServers };
    const expectedServers = { other, 'agentic-mcp': AGENTIC_SERVER_ENTRY };

    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      target,
    });

    expect(result.mergedConfig).toStrictEqual({
      $schema: 'https://opencode.ai/config.json',
      mcp: expectedServers,
    });
  });

  it('GIVEN an agentic entry with a higher timeout WHEN merging THEN it is unchanged and keeps the user value', () => {
    const userEntry = { ...AGENTIC_SERVER_ENTRY, timeout: 7_200_000 };
    const existingServers = { 'agentic-mcp': userEntry };
    const existingConfig = { mcpServers: existingServers };

    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: TIMED_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
    });

    expect(result.status).toBe('unchanged');
    expect(result.mergedConfig).toStrictEqual(existingConfig);
    expect(result.notes).toStrictEqual(['agentic-mcp timeout: kept your 7200000 (not lower than 4260000).']);
  });

  it('GIVEN an agentic entry with a lower timeout and its own env WHEN merging THEN the timeout is raised and env kept', () => {
    const env = { DEBUG: '1' };
    const userEntry = { ...AGENTIC_SERVER_ENTRY, env, timeout: 600_000 };
    const existingServers = { 'agentic-mcp': userEntry };
    const existingConfig = { mcpServers: existingServers };
    const raisedEntry = { ...AGENTIC_SERVER_ENTRY, env, timeout: 4_260_000 };
    const expectedServers = { 'agentic-mcp': raisedEntry };

    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: TIMED_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
    });

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({ mcpServers: expectedServers });
    expect(result.notes).toStrictEqual(['agentic-mcp timeout: raised from 600000 to 4260000.']);
  });

  it('GIVEN an agentic entry with a remote url WHEN merging THEN it is refused as unmergeable and the url is not mixed with a command', () => {
    const remoteEntry = { type: 'http', url: 'https://example.com/mcp' };
    const existingServers = { 'agentic-mcp': remoteEntry };
    const existingConfig = { mcpServers: existingServers };

    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: TIMED_SERVER_ENTRY,
      target: MCP_SERVERS_TARGET,
    });

    expect(result.status).toBe('unmergeable');
    expect(result.reason).toBe(REMOTE_URL_REASON);
  });
});
