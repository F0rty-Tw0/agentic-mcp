/**
 * Integration test — exercises the full MCP server wiring end-to-end
 * using in-memory transports. No mocks, no stubs.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServer } from './create-server';
import type { McpTextContent } from '../../shared/common';

let server: McpServer;
let client: Client;

beforeAll(async () => {
  server = await createServer();

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  client = new Client({ name: 'integration-test', version: '0.0.0' });
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client.close();
  await server.close();
});

describe('integration: tool listing', () => {
  it('GIVEN a running server WHEN listing tools THEN list_providers is registered', async () => {
    const { tools } = await client.listTools();

    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('list_providers');
  });

  it('GIVEN a running server WHEN listing tools THEN ask/ping/help tools exist for available providers', async () => {
    const { tools } = await client.listTools();

    const toolNames = tools.map((t) => t.name);
    // Exclude global tools (ask_all) — they don't have per-provider ping/help counterparts
    const askTools = toolNames.filter((n) => n.startsWith('ask_') && n !== 'ask_all');
    const pingTools = toolNames.filter((n) => n.startsWith('ping_'));
    const helpTools = toolNames.filter((n) => n.startsWith('help_'));

    // Every provider with ask should also have ping and help
    for (const askTool of askTools) {
      const providerName = askTool.replace('ask_', '');

      expect(pingTools).toContain(`ping_${providerName}`);
      expect(helpTools).toContain(`help_${providerName}`);
    }
  });

  it('GIVEN a running server WHEN listing tools THEN each tool has a description', async () => {
    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.description, `${tool.name} should have a description`).toBeTruthy();
    }
  });
});

/**
 * Extracts the first available provider name from the tool listing.
 * Returns `undefined` when no provider CLIs are installed locally.
 */
const findAvailableProvider = async (): Promise<string | undefined> => {
  const { tools } = await client.listTools();
  const pingTools = tools.filter((t) => t.name.startsWith('ping_'));

  for (const tool of pingTools) {
    const result = (await client.callTool({ name: tool.name })) as CallToolResult;
    const text = (result.content[0] as McpTextContent).text;

    if (text.includes('available')) {
      return tool.name.replace('ping_', '');
    }
  }

  return;
};

describe('integration: ping', () => {
  it('GIVEN an available provider WHEN calling ping THEN it returns an availability message', async () => {
    const provider = await findAvailableProvider();

    if (!provider) return; // no CLIs installed — nothing to assert

    const result = (await client.callTool({ name: `ping_${provider}` })) as CallToolResult;

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');

    const text = (result.content[0] as McpTextContent).text;

    expect(text).toContain(provider);
    expect(text).toContain('available');
  });
});

describe('integration: help', () => {
  it('GIVEN an available provider WHEN calling help THEN it returns non-empty help text', async () => {
    const provider = await findAvailableProvider();

    if (!provider) return; // no CLIs installed — nothing to assert

    const result = (await client.callTool({ name: `help_${provider}` })) as CallToolResult;

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');

    const text = (result.content[0] as McpTextContent).text;

    expect(text.length).toBeGreaterThan(0);
  });
});

describe('integration: list_providers', () => {
  it('GIVEN a running server WHEN calling list_providers THEN it returns provider status', async () => {
    const result = (await client.callTool({ name: 'list_providers' })) as CallToolResult;

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');

    const text = (result.content[0] as McpTextContent).text;

    // Should contain at least one provider from bundled config
    expect(text).toMatch(/claude|codex|copilot|gemini|opencode/);
  });

  it('GIVEN a running server WHEN calling list_providers THEN each provider shows a status label', async () => {
    const result = (await client.callTool({ name: 'list_providers' })) as CallToolResult;

    const text = (result.content[0] as McpTextContent).text;

    // Status labels from meta-handler: "available", "not found", or "disabled"
    expect(text).toMatch(/available|not found|disabled/);
  });
});
