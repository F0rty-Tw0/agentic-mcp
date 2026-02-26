import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { registerAllTools } from './tool-registry';
import { handleAsk } from '../../ask/domain-logic/ask.handler';
import { handleSessions } from '../../ask/domain-logic/sessions.handler';
import { handleAskAll } from '../../ask-all/domain-logic/ask-all.handler';
import { buildProviderMetricsToolDefinition, handleProviderMetrics } from '../../provider-metrics';
import type { ProviderConfig, ResolvedProvider, ResolvedProviderEntry } from '../../shared/common';
import { handleHelp, handleListProviders, handlePing } from '../../simple-tools';
import {
  TOOL_REGISTRY_PROVIDER_CONFIG_STUB,
  TOOL_REGISTRY_PROVIDER_METRICS_TOOL_DEFINITION_STUB,
  TOOL_REGISTRY_RESOLVED_PROVIDER_ENTRY_STUB,
  TOOL_REGISTRY_RESOLVED_PROVIDER_STUB,
  TOOL_REGISTRY_SUCCESS_CALL_TOOL_RESULT_STUB,
} from '../common/stubs';

vi.mock('../../provider-metrics');
vi.mock('../../ask/domain-logic/ask.handler', () => ({ handleAsk: vi.fn() }));
vi.mock('../../ask/domain-logic/sessions.handler', () => ({ handleSessions: vi.fn() }));
vi.mock('../../ask-all/domain-logic/ask-all.handler', () => ({ handleAskAll: vi.fn() }));
vi.mock('../../simple-tools/domain-logic/help.handler', () => ({ handleHelp: vi.fn() }));
vi.mock('../../simple-tools/domain-logic/meta.handler', () => ({ handleListProviders: vi.fn() }));
vi.mock('../../simple-tools/domain-logic/ping.handler', () => ({ handlePing: vi.fn() }));

const makeConfig = (): ProviderConfig => ({ ...TOOL_REGISTRY_PROVIDER_CONFIG_STUB });
const makeProvider = (name = 'claude'): ResolvedProviderEntry => ({
  ...TOOL_REGISTRY_RESOLVED_PROVIDER_ENTRY_STUB,
  name,
  binaryPath: `/usr/bin/${name}`,
  config: makeConfig(),
});
const makeResolvedProvider = (name = 'claude'): ResolvedProvider => ({
  ...TOOL_REGISTRY_RESOLVED_PROVIDER_STUB,
  name,
  description: `${name} provider`,
  binaryPath: `/usr/bin/${name}`,
});
const SUCCESS_RESULT: CallToolResult = TOOL_REGISTRY_SUCCESS_CALL_TOOL_RESULT_STUB;

type MockServer = Readonly<{ registerTool: MockInstance }>;
type ToolMetadata = Readonly<Record<string, unknown>>;
const getRegisteredNames = (server: MockServer): string[] =>
  server.registerTool.mock.calls.map(([call]: unknown[]) => call as string);
const getHandler = (server: MockServer, toolName: string): ((...args: unknown[]) => unknown) => {
  const call = server.registerTool.mock.calls.find((c: unknown[]) => c[0] === toolName);

  if (!call) throw new Error(`Tool "${toolName}" not registered`);

  return call[2] as (...args: unknown[]) => unknown;
};
const getMetadata = (server: MockServer, toolName: string): ToolMetadata => {
  const call = server.registerTool.mock.calls.find((c: unknown[]) => c[0] === toolName);

  if (!call) throw new Error(`Tool "${toolName}" not registered`);

  return call[1] as ToolMetadata;
};

describe('registerAllTools', () => {
  let server: MockServer;
  let register: (
    resolvedProviders?: readonly ResolvedProviderEntry[],
    allProviders?: readonly ResolvedProvider[]
  ) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildProviderMetricsToolDefinition).mockReturnValue(TOOL_REGISTRY_PROVIDER_METRICS_TOOL_DEFINITION_STUB);
    server = { registerTool: vi.fn() };
    register = (resolvedProviders = [], allProviders = []): void => {
      registerAllTools(server as unknown as McpServer, resolvedProviders, allProviders);
    };
  });

  describe('registration counts', () => {
    it('GIVEN no providers WHEN called THEN registers ask_all, provider_metrics and list_providers', () => {
      register();

      expect(server.registerTool).toHaveBeenCalledTimes(3);
    });

    it('GIVEN one provider WHEN called THEN registers 6 tools', () => {
      register([makeProvider()], [makeResolvedProvider()]);

      expect(server.registerTool).toHaveBeenCalledTimes(6);
    });

    it('GIVEN provider with sessions command WHEN called THEN registers 7 tools', () => {
      const providerWithSessions: ResolvedProviderEntry = {
        ...makeProvider(),
        config: {
          ...makeConfig(),
          commands: {
            ...makeConfig().commands,
            sessions: { flags: { resume: '--resume' } },
          },
        },
      };

      register([providerWithSessions], [makeResolvedProvider()]);

      expect(server.registerTool).toHaveBeenCalledTimes(7);
    });

    it('GIVEN two providers WHEN called THEN registers 9 tools', () => {
      register(
        [makeProvider('claude'), makeProvider('codex')],
        [makeResolvedProvider('claude'), makeResolvedProvider('codex')]
      );

      expect(server.registerTool).toHaveBeenCalledTimes(9);
    });
  });

  describe('tool naming', () => {
    it('GIVEN provider "claude" WHEN called THEN registers ask_claude, ping_claude, help_claude', () => {
      register([makeProvider('claude')]);

      const names = getRegisteredNames(server);

      expect(names).toContain('ask_claude');
      expect(names).toContain('ping_claude');
      expect(names).toContain('help_claude');
    });

    it('GIVEN no providers WHEN called THEN always registers list_providers', () => {
      register();

      const names = getRegisteredNames(server);

      expect(names).toContain('list_providers');
    });

    it('GIVEN two providers WHEN called THEN registers tools for each provider', () => {
      register([makeProvider('claude'), makeProvider('codex')]);

      const names = getRegisteredNames(server);

      expect(names).toContain('ask_claude');
      expect(names).toContain('ask_codex');
      expect(names).toContain('ping_claude');
      expect(names).toContain('ping_codex');
      expect(names).toContain('help_claude');
      expect(names).toContain('help_codex');
    });
  });

  describe('tool annotations', () => {
    it('GIVEN ask tool WHEN registered THEN has destructive and openWorld hints', () => {
      register([makeProvider('claude')]);

      const metadata = getMetadata(server, 'ask_claude');

      expect(metadata.annotations).toStrictEqual({ destructiveHint: true, openWorldHint: true });
    });

    it('GIVEN ping tool WHEN registered THEN has readOnly and idempotent hints', () => {
      register([makeProvider('claude')]);

      const metadata = getMetadata(server, 'ping_claude');

      expect(metadata.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
    });

    it('GIVEN help tool WHEN registered THEN has readOnly and idempotent hints', () => {
      register([makeProvider('claude')]);

      const metadata = getMetadata(server, 'help_claude');

      expect(metadata.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
    });

    it('GIVEN list_providers tool WHEN registered THEN has readOnly and idempotent hints', () => {
      register();

      const metadata = getMetadata(server, 'list_providers');

      expect(metadata.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
    });
  });

  describe('tool descriptions', () => {
    it('GIVEN provider "claude" WHEN ask tool registered THEN description mentions provider name', () => {
      register([makeProvider('claude')]);

      const metadata = getMetadata(server, 'ask_claude');

      expect(metadata.description).toContain('claude');
    });

    it('GIVEN provider "claude" WHEN ping tool registered THEN description mentions provider name', () => {
      register([makeProvider('claude')]);

      const metadata = getMetadata(server, 'ping_claude');

      expect(metadata.description).toContain('claude');
    });

    it('GIVEN provider "claude" WHEN help tool registered THEN description mentions provider name', () => {
      register([makeProvider('claude')]);

      const metadata = getMetadata(server, 'help_claude');

      expect(metadata.description).toContain('claude');
    });

    it('GIVEN list_providers WHEN registered THEN description mentions AI models', () => {
      register();

      const metadata = getMetadata(server, 'list_providers');

      expect(metadata.description).toContain('AI models');
    });
  });

  describe('handler wiring', () => {
    it('GIVEN ask handler WHEN invoked THEN delegates to handleAsk with provider and args', async () => {
      const provider = makeProvider('claude');

      vi.mocked(handleAsk).mockResolvedValue(SUCCESS_RESULT);

      register([provider]);

      const handler = getHandler(server, 'ask_claude');
      const args = { prompt: 'hello' };
      const result = await handler(args);

      expect(handleAsk).toHaveBeenCalledWith(provider, args, undefined);
      expect(result).toBe(SUCCESS_RESULT);
    });

    it('GIVEN ping handler WHEN invoked THEN delegates to handlePing with provider', async () => {
      const provider = makeProvider('claude');

      vi.mocked(handlePing).mockResolvedValue(SUCCESS_RESULT);

      register([provider]);

      const handler = getHandler(server, 'ping_claude');
      const result = await handler();

      expect(handlePing).toHaveBeenCalledWith(provider);
      expect(result).toBe(SUCCESS_RESULT);
    });

    it('GIVEN sessions handler WHEN invoked THEN delegates to handleSessions with provider name', async () => {
      const providerWithSessions: ResolvedProviderEntry = {
        ...makeProvider('claude'),
        config: {
          ...makeConfig(),
          commands: {
            ...makeConfig().commands,
            sessions: { flags: { continue: '--continue' } },
          },
        },
      };

      vi.mocked(handleSessions).mockReturnValue(SUCCESS_RESULT);

      register([providerWithSessions]);

      const handler = getHandler(server, 'sessions_claude');
      const result = await handler();

      expect(handleSessions).toHaveBeenCalledWith('claude');
      expect(result).toBe(SUCCESS_RESULT);
    });

    it('GIVEN help handler WHEN invoked THEN delegates to handleHelp with provider', async () => {
      const provider = makeProvider('claude');

      vi.mocked(handleHelp).mockResolvedValue(SUCCESS_RESULT);

      register([provider]);

      const handler = getHandler(server, 'help_claude');
      const result = await handler();

      expect(handleHelp).toHaveBeenCalledWith(provider);
      expect(result).toBe(SUCCESS_RESULT);
    });

    it('GIVEN list_providers handler WHEN invoked THEN delegates to handleListProviders with allProviders', () => {
      const allProviders = [makeResolvedProvider('claude'), makeResolvedProvider('codex')];

      vi.mocked(handleListProviders).mockReturnValue(SUCCESS_RESULT);

      register([], allProviders);

      const handler = getHandler(server, 'list_providers');
      const result = handler();

      expect(handleListProviders).toHaveBeenCalledWith(allProviders);
      expect(result).toBe(SUCCESS_RESULT);
    });

    it('GIVEN multiple providers WHEN ask handlers invoked THEN each receives its own provider', async () => {
      const claude = makeProvider('claude');
      const codex = makeProvider('codex');

      vi.mocked(handleAsk).mockResolvedValue(SUCCESS_RESULT);

      register([claude, codex]);

      await getHandler(server, 'ask_claude')({ prompt: 'hi' });

      expect(handleAsk).toHaveBeenCalledWith(claude, { prompt: 'hi' }, undefined);

      await getHandler(server, 'ask_codex')({ prompt: 'hey' });

      expect(handleAsk).toHaveBeenCalledWith(codex, { prompt: 'hey' }, undefined);
    });

    it('GIVEN ask_all handler WHEN invoked THEN delegates to handleAskAll with resolvedProviders and args', async () => {
      const claude = makeProvider('claude');
      const codex = makeProvider('codex');

      vi.mocked(handleAskAll).mockResolvedValue(SUCCESS_RESULT);

      register([claude, codex]);

      const handler = getHandler(server, 'ask_all');
      const args = { prompt: 'hello' };
      const result = await handler(args);

      expect(handleAskAll).toHaveBeenCalledWith([claude, codex], args);
      expect(result).toBe(SUCCESS_RESULT);
    });
  });

  describe('ask_all tool', () => {
    it('GIVEN no providers WHEN called THEN registers ask_all', () => {
      register();

      const names = getRegisteredNames(server);

      expect(names).toContain('ask_all');
    });

    it('GIVEN ask_all tool WHEN registered THEN has destructive and openWorld hints', () => {
      register([makeProvider('claude')]);

      const metadata = getMetadata(server, 'ask_all');

      expect(metadata.annotations).toStrictEqual({ destructiveHint: true, openWorldHint: true });
    });

    it('GIVEN ask_all tool WHEN registered THEN description mentions all providers', () => {
      register([makeProvider('claude'), makeProvider('codex')]);

      const metadata = getMetadata(server, 'ask_all');

      expect(metadata.description).toContain('claude');
      expect(metadata.description).toContain('codex');
    });
  });

  describe('provider_metrics tool', () => {
    it('GIVEN no providers WHEN called THEN registers provider_metrics', () => {
      register();

      const names = getRegisteredNames(server);

      expect(names).toContain('provider_metrics');
    });

    it('GIVEN provider_metrics tool WHEN registered THEN has readOnly and idempotent hints', () => {
      register();

      const metadata = getMetadata(server, 'provider_metrics');

      expect(metadata.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
    });

    it('GIVEN provider_metrics handler WHEN invoked THEN delegates to handleProviderMetrics', () => {
      vi.mocked(handleProviderMetrics).mockReturnValue(SUCCESS_RESULT);

      register();

      const handler = getHandler(server, 'provider_metrics');
      const result = handler();

      expect(handleProviderMetrics).toHaveBeenCalledOnce();
      expect(result).toBe(SUCCESS_RESULT);
    });
  });
});
