import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { registerAllTools } from './tool-registry';
import { handleAsk } from '../../ask/domain-logic/ask.handler';
import { handleAskAll } from '../../ask-all/domain-logic/ask-all.handler';
import { TOOL_REGISTRY_SUCCESS_CALL_TOOL_RESULT_STUB } from '../test/stubs/tool-registry.stub';
import {
  makeExpectedProgressContext,
  makeProvider,
  makeToolRequestContext,
} from '../test/utils/tool-registry.spec.util';

vi.mock('../../ask/domain-logic/ask.handler', () => {
  const mockedModule = { handleAsk: vi.fn() };

  return mockedModule;
});
vi.mock('../../ask-all/domain-logic/ask-all.handler', () => {
  const mockedModule = { handleAskAll: vi.fn() };

  return mockedModule;
});

type MockServer = { readonly registerTool: MockInstance };

type ToolHandler = (...args: unknown[]) => unknown;

const SUCCESS_RESULT: CallToolResult = TOOL_REGISTRY_SUCCESS_CALL_TOOL_RESULT_STUB;

const getHandler = (server: MockServer, toolName: string): ToolHandler => {
  const call = server.registerTool.mock.calls.find((candidate: unknown[]) => candidate[0] === toolName);

  if (!call) throw new Error(`Tool "${toolName}" not registered`);

  return call[2] as ToolHandler;
};

describe('registerAllTools progress context', () => {
  let server: MockServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = { registerTool: vi.fn() };
  });

  describe('GIVEN a registered ask tool', () => {
    describe('WHEN the SDK invokes it with a request context', () => {
      it('THEN handleAsk receives the provider, args and the progress context adapted from that request', async () => {
        const provider = makeProvider('claude');

        vi.mocked(handleAsk).mockResolvedValue(SUCCESS_RESULT);
        registerAllTools(server as unknown as McpServer, [provider], []);

        const handler = getHandler(server, 'ask_claude');
        const args = { prompt: 'hello' };
        const ctx = makeToolRequestContext();
        const result = await handler(args, ctx);
        const expectedProgressContext = makeExpectedProgressContext(ctx);

        expect(handleAsk).toHaveBeenCalledWith(provider, args, expectedProgressContext);
        expect(result).toBe(SUCCESS_RESULT);
      });
    });
  });

  describe('GIVEN the registered ask_all tool', () => {
    describe('WHEN the SDK invokes it with a request context', () => {
      it('THEN handleAskAll receives the providers, args and the progress context adapted from that request', async () => {
        const claude = makeProvider('claude');
        const codex = makeProvider('codex');

        vi.mocked(handleAskAll).mockResolvedValue(SUCCESS_RESULT);
        registerAllTools(server as unknown as McpServer, [claude, codex], []);

        const handler = getHandler(server, 'ask_all');
        const args = { prompt: 'hello' };
        const ctx = makeToolRequestContext();
        const result = await handler(args, ctx);
        const expectedProgressContext = makeExpectedProgressContext(ctx);

        expect(handleAskAll).toHaveBeenCalledWith([claude, codex], args, expectedProgressContext);
        expect(result).toBe(SUCCESS_RESULT);
      });
    });
  });
});
