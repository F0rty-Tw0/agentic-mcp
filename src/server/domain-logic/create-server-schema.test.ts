/**
 * Integration test — verifies config-to-tool-schema fidelity end-to-end.
 * Exercises the full MCP server wiring using in-memory transports.
 * No mocks, no stubs.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServer } from './create-server';

let server: McpServer;
let client: Client;

beforeAll(async () => {
  server = await createServer();

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  client = new Client({ name: 'schema-integration-test', version: '0.0.0' });
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client.close();
  await server.close();
});

describe('integration: ask tool input schema', () => {
  it('GIVEN registered tools WHEN filtering to ask_* THEN every ask tool has inputSchema.properties.prompt', async () => {
    const { tools } = await client.listTools();

    const askTools = tools.filter((t) => t.name.startsWith('ask_'));

    expect(askTools.length).toBeGreaterThan(0);

    for (const tool of askTools) {
      const properties = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};

      expect(properties.prompt, `${tool.name} should have inputSchema.properties.prompt`).toBeDefined();
    }
  });

  it('GIVEN registered tools WHEN filtering to ask_* (excluding ask_all) THEN every ask tool has standard optional fields', async () => {
    const { tools } = await client.listTools();

    const askTools = tools.filter((t) => t.name.startsWith('ask_') && t.name !== 'ask_all');

    expect(askTools.length).toBeGreaterThan(0);

    const alwaysPresentFields = ['stream_live', 'mode', 'action', 'job_id'] as const;

    const missingFields = askTools.flatMap((tool) => {
      const properties = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};

      return alwaysPresentFields.filter((f) => !(f in properties)).map((f) => `${tool.name}.${f}`);
    });

    expect(missingFields, 'All ask tools should have standard optional fields').toStrictEqual([]);
  });
});

describe('integration: tool descriptions', () => {
  it('GIVEN all registered tools WHEN inspecting descriptions THEN every tool has a non-empty string description', async () => {
    const { tools } = await client.listTools();

    expect(tools.length).toBeGreaterThan(0);

    for (const tool of tools) {
      expect(typeof tool.description, `${tool.name} description should be a string`).toBe('string');
      expect((tool.description as string).length, `${tool.name} description should be non-empty`).toBeGreaterThan(0);
    }
  });
});

describe('integration: provider tool completeness', () => {
  it('GIVEN registered tools WHEN checking per-provider ask tools THEN ping and help also exist', async () => {
    const { tools } = await client.listTools();

    const toolNames = new Set(tools.map((t) => t.name));
    const providerAskTools = tools.filter((t) => t.name.startsWith('ask_') && t.name !== 'ask_all');

    expect(providerAskTools.length).toBeGreaterThan(0);

    for (const tool of providerAskTools) {
      const providerName = tool.name.replace('ask_', '');

      expect(toolNames.has(`ping_${providerName}`), `ping_${providerName} should exist`).toBe(true);
      expect(toolNames.has(`help_${providerName}`), `help_${providerName} should exist`).toBe(true);
    }
  });

  it('GIVEN registered tools WHEN checking sessions tools THEN each has a matching ask tool', async () => {
    const { tools } = await client.listTools();

    const toolNames = new Set(tools.map((t) => t.name));
    const sessionTools = tools.filter((t) => t.name.startsWith('sessions_'));

    for (const tool of sessionTools) {
      const providerName = tool.name.replace('sessions_', '');

      expect(
        toolNames.has(`ask_${providerName}`),
        `ask_${providerName} should exist for sessions_${providerName}`
      ).toBe(true);
    }
  });
});

describe('integration: global tools', () => {
  it('GIVEN a running server WHEN listing tools THEN ask_all is registered', async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('ask_all');
  });

  it('GIVEN a running server WHEN listing tools THEN list_providers is registered', async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('list_providers');
  });

  it('GIVEN a running server WHEN listing tools THEN provider_metrics is registered', async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('provider_metrics');
  });
});
