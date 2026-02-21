import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { registerAllTools } from './tool-registry.ts';
import type { ProviderConfig } from '../../shared/common/provider-config.schema.ts';
import type { ResolvedProvider, ResolvedProviderEntry } from '../../shared/common/provider-config.type.ts';
import { handleAsk } from '../ask/domain-logic/ask.handler.ts';
import { handleHelp } from '../simple-tools/domain-logic/help.handler.ts';
import { handleListProviders } from '../simple-tools/domain-logic/meta.handler.ts';
import { handlePing } from '../simple-tools/domain-logic/ping.handler.ts';

vi.mock('../ask/domain-logic/ask.handler.ts', () => ({ handleAsk: vi.fn() }));
vi.mock('../simple-tools/domain-logic/help.handler.ts', () => ({ handleHelp: vi.fn() }));
vi.mock('../simple-tools/domain-logic/meta.handler.ts', () => ({ handleListProviders: vi.fn() }));
vi.mock('../simple-tools/domain-logic/ping.handler.ts', () => ({ handlePing: vi.fn() }));

const makeConfig = (): ProviderConfig => ({
  enabled: true,
  description: 'test provider',
  command: 'test-cli',
  timeout: 30_000,
  env: {},
  outputFormat: 'text',
  commands: { ask: { args: ['exec'], flags: { model: '-m' } } },
  input: { method: 'positional' },
});

const makeProvider = (name = 'claude'): ResolvedProviderEntry => ({
  name,
  binaryPath: `/usr/bin/${name}`,
  config: makeConfig(),
});

const makeResolvedProvider = (name = 'claude'): ResolvedProvider => ({
  name,
  description: `${name} provider`,
  enabled: true,
  available: true,
  binaryPath: `/usr/bin/${name}`,
});

const SUCCESS_RESULT: CallToolResult = {
  content: [{ type: 'text', text: 'ok' }],
};

type MockServer = Readonly<{ registerTool: MockInstance }>;

const getRegisteredNames = (server: MockServer): string[] =>
  server.registerTool.mock.calls.map((call: unknown[]) => call[0] as string);

const getHandler = (server: MockServer, toolName: string): ((...args: unknown[]) => unknown) => {
  const call = server.registerTool.mock.calls.find((c: unknown[]) => c[0] === toolName);

  if (!call) throw new Error(`Tool "${toolName}" not registered`);

  return call[2] as (...args: unknown[]) => unknown;
};

const getMetadata = (server: MockServer, toolName: string): Record<string, unknown> => {
  const call = server.registerTool.mock.calls.find((c: unknown[]) => c[0] === toolName);

  if (!call) throw new Error(`Tool "${toolName}" not registered`);

  return call[1] as Record<string, unknown>;
};

describe('registerAllTools', () => {
  let server: MockServer;
  let register: (
    resolvedProviders?: readonly ResolvedProviderEntry[],
    allProviders?: readonly ResolvedProvider[],
  ) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    server = { registerTool: vi.fn() };
    register = (resolvedProviders = [], allProviders = []): void => {
      registerAllTools(server as unknown as McpServer, resolvedProviders, allProviders);
    };
  });

  describe('registration counts', () => {
    it('GIVEN no providers WHEN called THEN registers only list_providers', () => {
      register();

      expect(server.registerTool).toHaveBeenCalledTimes(1);
    });

    it('GIVEN one provider WHEN called THEN registers 4 tools', () => {
      register([makeProvider()], [makeResolvedProvider()]);

      expect(server.registerTool).toHaveBeenCalledTimes(4);
    });

    it('GIVEN two providers WHEN called THEN registers 7 tools', () => {
      register(
        [makeProvider('claude'), makeProvider('codex')],
        [makeResolvedProvider('claude'), makeResolvedProvider('codex')],
      );

      expect(server.registerTool).toHaveBeenCalledTimes(7);
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

    it('GIVEN list_providers WHEN registered THEN description mentions providers', () => {
      register();

      const metadata = getMetadata(server, 'list_providers');

      expect(metadata.description).toContain('provider');
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
  });
});
