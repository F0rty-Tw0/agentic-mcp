import type { CallToolResult } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { registerAllTools } from './tool-registry';
import { handleReview } from '../../ask/domain-logic/review.handler';
import type { ProviderConfig, ResolvedProvider, ResolvedProviderEntry } from '../../shared';
import { ValidationError } from '../../shared';
import { makeExpectedProgressContext, makeToolRequestContext } from '../test/utils/tool-registry.spec.util';

vi.mock('../../ask/domain-logic/review.handler', () => {
  const mockedModule = { handleReview: vi.fn() };

  return mockedModule;
});

type ProviderCommands = ProviderConfig['commands'];

const createConfig = (withReview: boolean): ProviderConfig => {
  const ask = { args: ['exec'] };
  const flags = {
    uncommitted: ['--uncommitted'],
    base: '--base',
    commit: '--commit',
  };
  const review = {
    args: ['review'],
    flags,
  };
  const reviewCommands: ProviderCommands = { review };
  const noReviewCommands: ProviderCommands = {};
  const optionalCommands = withReview ? reviewCommands : noReviewCommands;
  const commands = {
    ask,
    ...optionalCommands,
  };
  const input: ProviderConfig['input'] = { method: 'positional' };
  const providerConfig: ProviderConfig = {
    enabled: true,
    description: 'Provider config',
    command: 'codex',
    timeout: 120_000,
    env: {},
    outputFormat: 'json',
    commands,
    input,
  };

  return providerConfig;
};

const createProviderEntry = (name: string, withReview: boolean): ResolvedProviderEntry => {
  const resolvedProviderEntry: ResolvedProviderEntry = {
    name,
    binaryPath: `/usr/bin/${name}`,
    config: createConfig(withReview),
  };

  return resolvedProviderEntry;
};

const createResolvedProvider = (name: string): ResolvedProvider => {
  const resolvedProvider: ResolvedProvider = {
    name,
    description: `${name} provider`,
    enabled: true,
    available: true,
    binaryPath: `/usr/bin/${name}`,
  };

  return resolvedProvider;
};

type MockServer = { readonly registerTool: MockInstance };

const getRegisteredNames = (server: MockServer): string[] => {
  return server.registerTool.mock.calls.map(([toolName]: unknown[]) => toolName as string);
};

const getHandler = (server: MockServer, toolName: string): ((...args: unknown[]) => unknown) => {
  const call = server.registerTool.mock.calls.find((candidate: unknown[]) => candidate[0] === toolName);

  if (!call) throw new Error(`Tool ${toolName} was not registered`);

  return call[2] as (...args: unknown[]) => unknown;
};

describe('registerAllTools review support', () => {
  let server: MockServer;
  const content: CallToolResult['content'] = [{ type: 'text', text: 'review output' }];
  const successResult: CallToolResult = { content };

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

  it('GIVEN registered review handler WHEN invoked THEN it delegates to handleReview with provider, args and the progress context of the request', async () => {
    const provider = createProviderEntry('codex', true);
    const args = { scope: 'uncommitted' };

    registerAllTools(server as never, [provider], [createResolvedProvider('codex')]);

    const handler = getHandler(server, 'review_codex');
    const ctx = makeToolRequestContext();
    const result = await handler(args, ctx);
    const expectedProgressContext = makeExpectedProgressContext(ctx);

    expect(handleReview).toHaveBeenCalledWith(provider, args, expectedProgressContext);
    expect(result).toBe(successResult);
  });

  it('GIVEN registered review handler WHEN invoked without a scope THEN rejects with ValidationError and skips handleReview', async () => {
    const provider = createProviderEntry('codex', true);

    registerAllTools(server as never, [provider], [createResolvedProvider('codex')]);

    const handler = getHandler(server, 'review_codex');

    await expect(handler({})).rejects.toThrow(ValidationError);
    expect(handleReview).not.toHaveBeenCalled();
  });
});
