/* eslint-disable @typescript-eslint/naming-convention */
import { describe, expect, it } from 'vitest';

import { resolveProviderEnv } from './provider-env-resolver.ts';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS   } from '../common/index.ts';
import type {ProviderConfig, ResolvedProviderEntry} from '../common/index.ts';

const createContext = (overrides: Partial<ProviderConfig> = {}, providerName = 'test'): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    enabled: true,
    description: 'Test provider',
    command: 'test-cli',
    timeout: 120_000,
    env: {},
    outputFormat: 'json',
    commands: { ask: { args: ['exec'], flags: {} } },
    input: { method: 'positional' },
    ...overrides,
  };

  return {
    name: providerName,
    binaryPath: '/usr/bin/test-cli',
    config,
  };
};

describe('resolveProviderEnv', () => {
  it('GIVEN provider without MCP_TOOL_TIMEOUT WHEN resolving env THEN injects default timeout', () => {
    const context = createContext({ env: { API_KEY: 'secret' } }, 'codex');

    const resolvedEnv = resolveProviderEnv(context);

    expect(resolvedEnv).toStrictEqual({
      API_KEY: 'secret',
      MCP_TOOL_TIMEOUT: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
    });
  });

  it('GIVEN provider with MCP_TOOL_TIMEOUT WHEN resolving env THEN preserves explicit value', () => {
    const context = createContext({ env: { MCP_TOOL_TIMEOUT: '900000', API_KEY: 'secret' } }, 'gemini');

    const resolvedEnv = resolveProviderEnv(context);

    expect(resolvedEnv).toStrictEqual({
      MCP_TOOL_TIMEOUT: '900000',
      API_KEY: 'secret',
    });
  });
});
