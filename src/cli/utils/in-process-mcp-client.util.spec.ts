import type { CallToolResult, Progress } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { callCliTool } from './in-process-mcp-client.util';
import type { ConfigPathOptions } from '../../shared';

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
  const clientClose = vi.fn<() => Promise<void>>();
  const clientCtor = vi.fn();

  function mockClient(
    this: unknown,
    clientInfo: unknown
  ): {
    connect: typeof clientConnect;
    callTool: typeof clientCallTool;
    close: typeof clientClose;
  } {
    mocks.clientCtor(clientInfo);

    return {
      connect: mocks.clientConnect,
      callTool: mocks.clientCallTool,
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

  it('GIVEN provider-specific tool WHEN calling CLI tool THEN it scopes dangerous-flag warnings to that provider', async () => {
    await callCliTool({
      toolName: 'ask_claude',
      args: { prompt: 'hello' },
    });

    expect(mocks.createServer).toHaveBeenCalledWith({ configPath: undefined, providerNames: ['claude'] });
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
