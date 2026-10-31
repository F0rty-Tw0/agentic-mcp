/* eslint-disable @typescript-eslint/naming-convention */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveProviderEnv } from './provider-env-resolver';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../common';
import type { ProviderConfig, ResolvedProviderEntry } from '../common';

const createContext = (overrides: Partial<ProviderConfig> = {}, providerName = 'test'): ResolvedProviderEntry => {
  const ask = { args: ['exec'], flags: {} };
  const commands = { ask };
  const input: ProviderConfig['input'] = { method: 'positional' };
  const config: ProviderConfig = {
    enabled: true,
    description: 'Test provider',
    command: 'test-cli',
    timeout: 120_000,
    env: {},
    outputFormat: 'json',
    commands,
    input,
    ...overrides,
  };

  const resolvedProviderEntry: ResolvedProviderEntry = {
    name: providerName,
    binaryPath: '/usr/bin/test-cli',
    config,
  };

  return resolvedProviderEntry;
};

describe('resolveProviderEnv', () => {
  it('GIVEN provider without MCP_TOOL_TIMEOUT WHEN resolving env THEN injects default timeout', () => {
    const env = { API_KEY: 'secret' };
    const context = createContext({ env }, 'codex');

    const resolvedEnv = resolveProviderEnv(context);

    expect(resolvedEnv).toStrictEqual({
      API_KEY: 'secret',
      MCP_TOOL_TIMEOUT: String(DEFAULT_MCP_TOOL_TIMEOUT_MS),
    });
  });

  it('GIVEN provider with MCP_TOOL_TIMEOUT WHEN resolving env THEN preserves explicit value', () => {
    const env = { MCP_TOOL_TIMEOUT: '900000', API_KEY: 'secret' };
    const context = createContext({ env }, 'gemini');

    const resolvedEnv = resolveProviderEnv(context);

    expect(resolvedEnv).toStrictEqual({
      MCP_TOOL_TIMEOUT: '900000',
      API_KEY: 'secret',
    });
  });
  describe('envPassthrough', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('GIVEN a passthrough key set in the parent env WHEN resolving env THEN the provider gets its value', () => {
      vi.stubEnv('OPENAI_API_KEY', 'sk-parent');
      const context = createContext({ envPassthrough: ['OPENAI_API_KEY'] });

      const resolvedEnv = resolveProviderEnv(context);

      expect(resolvedEnv.OPENAI_API_KEY).toBe('sk-parent');
    });

    it('GIVEN a passthrough key missing from the parent env WHEN resolving env THEN it is left out', () => {
      vi.stubEnv('OPENAI_API_KEY', undefined);
      const context = createContext({ envPassthrough: ['OPENAI_API_KEY'] });

      const resolvedEnv = resolveProviderEnv(context);

      expect('OPENAI_API_KEY' in resolvedEnv).toBe(false);
    });

    it('GIVEN a passthrough name that is an Object.prototype member WHEN resolving env THEN nothing is passed', () => {
      const context = createContext({ envPassthrough: ['constructor', 'toString'] });

      const resolvedEnv = resolveProviderEnv(context);
      const keys = Object.keys(resolvedEnv);

      expect(keys).not.toContain('constructor');
      expect(keys).not.toContain('toString');
    });

    it('GIVEN a key in both env and envPassthrough WHEN resolving env THEN the explicit env value wins', () => {
      vi.stubEnv('OPENAI_API_KEY', 'sk-parent');
      const env = { OPENAI_API_KEY: 'sk-config' };
      const context = createContext({ env, envPassthrough: ['OPENAI_API_KEY'] });

      const resolvedEnv = resolveProviderEnv(context);

      expect(resolvedEnv.OPENAI_API_KEY).toBe('sk-config');
    });
  });
});
