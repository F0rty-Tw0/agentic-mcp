import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { registerAllTools } from './tool-registry';
import { handleReview } from '../../ask/domain-logic/review.handler';
import type { ProviderConfig, ResolvedProvider, ResolvedProviderEntry } from '../../shared';

vi.mock('../../ask/domain-logic/review.handler', () => ({ handleReview: vi.fn() }));

const createConfig = (withReview: boolean): ProviderConfig => ({
  enabled: true,
  description: 'Provider config',
  command: 'codex',
  timeout: 120_000,
  env: {},
  outputFormat: 'json',
  commands: {
    ask: { args: ['exec'] },
    ...(withReview
      ? {
          review: {
            args: ['review'],
            flags: {
              uncommitted: ['--uncommitted'],
              base: '--base',
              commit: '--commit',
            },
          },
        }
      : {}),
  },
  input: { method: 'positional' },
});

const createProviderEntry = (name: string, withReview: boolean): ResolvedProviderEntry => ({
  name,
  binaryPath: `/usr/bin/${name}`,
  config: createConfig(withReview),
});

const createResolvedProvider = (name: string): ResolvedProvider => ({
  name,
  description: `${name} provider`,
  enabled: true,
  available: true,
  binaryPath: `/usr/bin/${name}`,
});

type MockServer = Readonly<{ registerTool: MockInstance }>;

const getRegisteredNames = (server: MockServer): string[] => {
  return server.registerTool.mock.calls.map(([toolName]: unknown[]) => toolName as string);
};

const getHandler = (server: MockServer, toolName: string): ((...args: unknown[]) => unknown) => {
  const call = server.registerTool.mock.calls.find((candidate: unknown[]) => candidate[0] === toolName);

  if (!call) {
    throw new Error(`Tool ${toolName} was not registered`);
  }

  return call[2] as (...args: unknown[]) => unknown;
};

describe('registerAllTools review support', () => {
  let server: MockServer;
  const successResult: CallToolResult = { content: [{ type: 'text', text: 'review output' }] };

  beforeEach(() => {
    vi.clearAllMocks();
    server = { registerTool: vi.fn() };
    vi.mocked(handleReview).mockResolvedValue(successResult);
  });

  it('GIVEN provider with review command WHEN registering tools THEN review_{provider} is registered', () => {
    const provider = createProviderEntry('codex', true);

    registerAllTools(server as never, [provider], [createResolvedProvider('codex')]);

    expect(getRegisteredNames(server)).toContain('review_codex');
  });

  it('GIVEN provider without review command WHEN registering tools THEN no review tool is registered', () => {
    const provider = createProviderEntry('claude', false);

    registerAllTools(server as never, [provider], [createResolvedProvider('claude')]);

    expect(getRegisteredNames(server)).not.toContain('review_claude');
  });

  it('GIVEN registered review handler WHEN invoked THEN it delegates to handleReview with provider and args', async () => {
    const provider = createProviderEntry('codex', true);
    const args = { scope: 'uncommitted' };

    registerAllTools(server as never, [provider], [createResolvedProvider('codex')]);

    const handler = getHandler(server, 'review_codex');
    const result = await handler(args);

    expect(handleReview).toHaveBeenCalledWith(provider, args, undefined);
    expect(result).toBe(successResult);
  });
});
