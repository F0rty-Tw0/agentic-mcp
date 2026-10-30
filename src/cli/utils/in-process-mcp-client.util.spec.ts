import type { CallToolResult, Progress } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { callCliTool } from './in-process-mcp-client.util';
import type { ConfigPathOptions } from '../../shared';

type MockInputSchema = {
  readonly properties?: Readonly<Record<string, unknown>>;
};

type MockTool = {
  readonly name: string;
  readonly inputSchema?: MockInputSchema;
};

type MockListToolsResult = {
  readonly tools: MockTool[];
};

type MockServer = {
  readonly connect: (transport: unknown) => Promise<void>;
  readonly close: () => Promise<void>;
};

type MockClient = {
  readonly connect: Mock<(transport: unknown) => Promise<void>>;
  readonly callTool: Mock<(request: unknown, options?: unknown) => Promise<unknown>>;
  readonly listTools: Mock<() => Promise<MockListToolsResult>>;
  readonly close: Mock<() => Promise<void>>;
};

type MockTransport = {
  readonly side: string;
};

type MockState = {
  readonly clientCallTool: Mock<(request: unknown, options?: unknown) => Promise<unknown>>;
  readonly clientClass: Mock<(clientInfo: unknown) => MockClient>;
  readonly clientClose: Mock<() => Promise<void>>;
  readonly clientConnect: Mock<(transport: unknown) => Promise<void>>;
  readonly clientCtor: Mock<(clientInfo: unknown) => void>;
  readonly clientListTools: Mock<() => Promise<MockListToolsResult>>;
  readonly clientTransport: MockTransport;
  readonly createLinkedPair: Mock<() => readonly [unknown, unknown]>;
  readonly createServer: Mock<(options?: ConfigPathOptions) => Promise<MockServer>>;
  readonly serverClose: Mock<() => Promise<void>>;
  readonly serverConnect: Mock<(transport: unknown) => Promise<void>>;
  readonly serverTransport: MockTransport;
};

const mocks: MockState = vi.hoisted(() => {
  const clientTransport = { side: 'client' };
  const serverTransport = { side: 'server' };
  const serverConnect = vi.fn<(transport: unknown) => Promise<void>>();
  const serverClose = vi.fn<() => Promise<void>>();
  const createServer = vi.fn<(options?: ConfigPathOptions) => Promise<MockServer>>();
  const clientConnect = vi.fn<(transport: unknown) => Promise<void>>();
  const clientCallTool = vi.fn<(request: unknown, options?: unknown) => Promise<unknown>>();
  const clientListTools = vi.fn<() => Promise<MockListToolsResult>>();
  const clientClose = vi.fn<() => Promise<void>>();
  const clientCtor = vi.fn<(clientInfo: unknown) => void>();

  function mockClient(this: unknown, clientInfo: unknown): MockClient {
    clientCtor(clientInfo);

    const client: MockClient = {
      connect: clientConnect,
      callTool: clientCallTool,
      listTools: clientListTools,
      close: clientClose,
    };

    return client;
  }

  const clientClass = vi.fn(mockClient);
  const createLinkedPair = vi.fn<() => readonly [unknown, unknown]>();
  const mockState: MockState = {
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

  return mockState;
});

vi.mock('../../server', () => {
  const serverModule = { createServer: mocks.createServer };

  return serverModule;
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  const clientModule = { Client: mocks.clientClass };

  return clientModule;
});

vi.mock('@modelcontextprotocol/sdk/inMemory.js', () => {
  const inMemoryTransport = { createLinkedPair: mocks.createLinkedPair };
  const inMemoryModule = { InMemoryTransport: inMemoryTransport };

  return inMemoryModule;
});

const buildCallToolResult = (): CallToolResult => {
  const textPart: CallToolResult['content'][number] = { type: 'text', text: 'done' };
  const result: CallToolResult = { content: [textPart] };

  return result;
};

const buildTool = (name: string, properties: string[] = []): MockTool => {
  const schemaProperties = Object.fromEntries(properties.map((property) => [property, {}]));
  const inputSchema: MockInputSchema = { properties: schemaProperties };
  const result: MockTool = {
    name,
    inputSchema,
  };

  return result;
};

const buildListToolsResult = (tools: MockTool[] = []): MockListToolsResult => {
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

    const args = { prompt: 'hello' };
    const result = await callCliTool({
      toolName: 'ask_claude',
      args,
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
    const expectedRequest = { name: 'ask_claude', arguments: args };

    expect(mocks.clientCallTool).toHaveBeenCalledWith(expectedRequest, undefined, {
      onprogress: onProgress,
      resetTimeoutOnProgress: true,
      timeout: 1_800_000,
    });
    expect(mocks.clientClose).toHaveBeenCalledTimes(1);
    expect(mocks.serverClose).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(buildCallToolResult());
  });

  it('GIVEN unsupported ask args WHEN calling CLI tool THEN it rejects before invoking the MCP tool', async () => {
    mocks.clientListTools.mockResolvedValueOnce(buildListToolsResult([buildTool('ask_claude', ['prompt'])]));

    const args = { prompt: 'hello', files: ['src/cli/domain-logic/cli.router.ts'] };
    const callCliToolPromise = callCliTool({
      toolName: 'ask_claude',
      args,
    });

    await expect(callCliToolPromise).rejects.toThrow('Argument "--file" is not supported by ask_claude');
    expect(mocks.clientCallTool).not.toHaveBeenCalled();
    expect(mocks.clientClose).toHaveBeenCalledTimes(1);
    expect(mocks.serverClose).toHaveBeenCalledTimes(1);
  });

  it('GIVEN provider-specific ask tool WHEN calling CLI tool THEN it scopes dangerous-flag warnings to that provider', async () => {
    const args = { prompt: 'hello' };

    await callCliTool({
      toolName: 'ask_copilot',
      args,
    });

    expect(mocks.createServer).toHaveBeenCalledWith({
      configPath: undefined,
      providerNames: ['copilot'],
      warnDangerousFlags: true,
    });
  });

  it('GIVEN ask_all WHEN calling CLI tool THEN it enables dangerous-flag warnings without provider scoping', async () => {
    const args = { prompt: 'hello' };

    await callCliTool({
      toolName: 'ask_all',
      args,
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

    const args = { prompt: 'hello' };
    const callCliToolPromise = callCliTool({
      toolName: 'ask_nonexistent',
      args,
    });

    await expect(callCliToolPromise).rejects.toThrow('Provider "nonexistent" not found');
    expect(mocks.clientCallTool).not.toHaveBeenCalled();
    expect(mocks.clientClose).toHaveBeenCalledTimes(1);
    expect(mocks.serverClose).toHaveBeenCalledTimes(1);
  });

  it('GIVEN callTool resolves a malformed result WHEN calling a CLI tool THEN it rejects and still closes both client and server', async () => {
    const malformedResult = { content: 'not-a-content-array' };

    mocks.clientCallTool.mockResolvedValueOnce(malformedResult);

    const args = { prompt: 'hello' };
    const callCliToolPromise = callCliTool({
      toolName: 'ask_claude',
      args,
    });

    await expect(callCliToolPromise).rejects.toThrow('CLI tool "ask_claude" returned an unexpected result');
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
