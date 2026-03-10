import type { CallToolResult, Progress } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { callCliTool } from './in-process-mcp-client.util';
import type { ConfigPathOptions } from '../../shared';

type MockTool = Readonly<{
  name: string;
  inputSchema?: Readonly<{ properties?: Readonly<Record<string, unknown>> }>;
}>;

type MockListToolsResult = Readonly<{
  tools: readonly MockTool[];
}>;

type MockServer = Readonly<{
  connect: (transport: unknown) => Promise<void>;
  close: () => Promise<void>;
}>;

const mocks = vi.hoisted(() => {
  const clientTransport = { side: 'client' };
  const serverTransport = { side: 'server' };
  const serverConnect = vi.fn<(transport: unknown) => Promise<void>>();
  const serverClose = vi.fn<() => Promise<void>>();
  const createServer = vi.fn<(options?: ConfigPathOptions) => Promise<MockServer>>();
  const clientConnect = vi.fn<(transport: unknown) => Promise<void>>();
  const clientCallTool = vi.fn();
  const clientListTools = vi.fn<() => Promise<MockListToolsResult>>();
  const clientClose = vi.fn<() => Promise<void>>();
  const clientCtor = vi.fn();

  function mockClient(
    this: unknown,
    clientInfo: unknown
  ): {
    connect: typeof clientConnect;
    callTool: typeof clientCallTool;
    listTools: typeof clientListTools;
    close: typeof clientClose;
  } {
    mocks.clientCtor(clientInfo);

    return {
      connect: mocks.clientConnect,
      callTool: mocks.clientCallTool,
      listTools: mocks.clientListTools,
      close: mocks.clientClose,
    };
  }

  const clientClass = vi.fn(mockClient);
  const createLinkedPair = vi.fn<() => readonly [unknown, unknown]>();

  return {
    clientCallTool,
    clientClass,
    clientClose,
    clientConnect,
    clientCtor,
    clientListTools,
    clientTransport,
    createLinkedPair,
    createServer,
    serverClose,
    serverConnect,
    serverTransport,
  };
});

vi.mock('../../server', () => ({
  createServer: mocks.createServer,
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: mocks.clientClass,
}));

vi.mock('@modelcontextprotocol/sdk/inMemory.js', () => ({
  InMemoryTransport: {
    createLinkedPair: mocks.createLinkedPair,
  },
}));

const buildCallToolResult = (): CallToolResult => ({
  content: [{ type: 'text', text: 'done' }],
});

const buildTool = (name: string, properties: readonly string[] = []): MockTool => {
  const schemaProperties = Object.fromEntries(properties.map((property) => [property, {}]));
  const result: MockTool = {
    name,
    inputSchema: { properties: schemaProperties },
  };

  return result;
};

const buildListToolsResult = (tools: readonly MockTool[] = []): MockListToolsResult => {
  const result: MockListToolsResult = { tools };

  return result;
};

describe('callCliTool', () => {
  beforeEach(() => {
    mocks.serverConnect.mockReset();
    mocks.serverConnect.mockResolvedValue(undefined);
    mocks.serverClose.mockReset();
    mocks.serverClose.mockResolvedValue(undefined);
    mocks.createServer.mockReset();
    mocks.createServer.mockResolvedValue({
      connect: mocks.serverConnect,
      close: mocks.serverClose,
    });
    mocks.clientConnect.mockReset();
    mocks.clientConnect.mockResolvedValue(undefined);
    mocks.clientCallTool.mockReset();
    mocks.clientCallTool.mockResolvedValue(buildCallToolResult());
    mocks.clientListTools.mockReset();
    mocks.clientListTools.mockResolvedValue(
      buildListToolsResult([
        buildTool('ask_claude', ['prompt']),
        buildTool('ask_copilot', ['prompt']),
        buildTool('ask_all', ['prompt']),
        buildTool('help_copilot'),
        buildTool('ping_claude'),
      ])
    );
    mocks.clientClose.mockReset();
    mocks.clientClose.mockResolvedValue(undefined);
    mocks.clientClass.mockClear();
    mocks.clientCtor.mockReset();
    mocks.createLinkedPair.mockReset();
    mocks.createLinkedPair.mockReturnValue([mocks.clientTransport, mocks.serverTransport]);
  });

  it('GIVEN configPath and progress callback WHEN calling a CLI tool THEN it creates an in-process MCP client and forwards the request options', async () => {
    const onProgress = vi.fn<(progress: Progress) => void>();

    const result = await callCliTool({
      toolName: 'ask_claude',
      args: { prompt: 'hello' },
      configPath: '/tmp/providers.json',
      onProgress,
    });

    expect(mocks.createServer).toHaveBeenCalledWith({
      configPath: '/tmp/providers.json',
      providerNames: ['claude'],
      warnDangerousFlags: true,
    });
    expect(mocks.createLinkedPair).toHaveBeenCalledTimes(1);
    expect(mocks.serverConnect).toHaveBeenCalledWith(mocks.serverTransport);
    expect(mocks.clientConnect).toHaveBeenCalledWith(mocks.clientTransport);
    expect(mocks.clientCallTool).toHaveBeenCalledWith(
      { name: 'ask_claude', arguments: { prompt: 'hello' } },
      undefined,
      { onprogress: onProgress, resetTimeoutOnProgress: true }
    );
    expect(mocks.clientClose).toHaveBeenCalledTimes(1);
    expect(mocks.serverClose).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(buildCallToolResult());
  });

  it('GIVEN unsupported ask args WHEN calling CLI tool THEN it rejects before invoking the MCP tool', async () => {
    mocks.clientListTools.mockResolvedValueOnce(buildListToolsResult([buildTool('ask_claude', ['prompt'])]));

    const callCliToolPromise = callCliTool({
      toolName: 'ask_claude',
      args: { prompt: 'hello', files: ['src/cli/domain-logic/cli.router.ts'] },
    });

    await expect(callCliToolPromise).rejects.toThrow('Argument "--file" is not supported by ask_claude');
    expect(mocks.clientCallTool).not.toHaveBeenCalled();
    expect(mocks.clientClose).toHaveBeenCalledTimes(1);
    expect(mocks.serverClose).toHaveBeenCalledTimes(1);
  });

  it('GIVEN provider-specific ask tool WHEN calling CLI tool THEN it scopes dangerous-flag warnings to that provider', async () => {
    await callCliTool({
      toolName: 'ask_copilot',
      args: { prompt: 'hello' },
    });

    expect(mocks.createServer).toHaveBeenCalledWith({
      configPath: undefined,
      providerNames: ['copilot'],
      warnDangerousFlags: true,
    });
  });

  it('GIVEN ask_all WHEN calling CLI tool THEN it enables dangerous-flag warnings without provider scoping', async () => {
    await callCliTool({
      toolName: 'ask_all',
      args: { prompt: 'hello' },
    });

    expect(mocks.createServer).toHaveBeenCalledWith({
      configPath: undefined,
      providerNames: undefined,
      warnDangerousFlags: true,
    });
  });

  it('GIVEN non-ask provider tool WHEN calling CLI tool THEN it does not enable dangerous-flag warnings', async () => {
    await callCliTool({
      toolName: 'help_copilot',
      args: {},
    });

    expect(mocks.createServer).toHaveBeenCalledWith({
      configPath: undefined,
      providerNames: ['copilot'],
      warnDangerousFlags: false,
    });
  });

  it('GIVEN an unknown provider tool WHEN calling a CLI tool THEN it reports the provider as not found', async () => {
    mocks.clientListTools.mockResolvedValueOnce(buildListToolsResult([buildTool('ask_claude', ['prompt'])]));

    const callCliToolPromise = callCliTool({
      toolName: 'ask_nonexistent',
      args: { prompt: 'hello' },
    });

    await expect(callCliToolPromise).rejects.toThrow('Provider "nonexistent" not found');
    expect(mocks.clientCallTool).not.toHaveBeenCalled();
    expect(mocks.clientClose).toHaveBeenCalledTimes(1);
    expect(mocks.serverClose).toHaveBeenCalledTimes(1);
  });

  it('GIVEN callTool throws WHEN calling a CLI tool THEN it still closes both client and server', async () => {
    mocks.clientCallTool.mockRejectedValueOnce(new Error('boom'));

    const callCliToolPromise = callCliTool({
      toolName: 'ping_claude',
      args: {},
    });

    await expect(callCliToolPromise).rejects.toThrow('boom');
    expect(mocks.clientClose).toHaveBeenCalledTimes(1);
    expect(mocks.serverClose).toHaveBeenCalledTimes(1);
  });
});
