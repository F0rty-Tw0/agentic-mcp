import { describe, expect, it } from 'vitest';

import { buildAskToolDefinition } from './ask-tool.builder';
import type { ProviderConfig } from '../../shared';

type AskToolFlags = Readonly<Record<string, unknown>>;

const createConfig = (flags: AskToolFlags): ProviderConfig => {
  const ask = { args: ['-p'], flags: flags as ProviderConfig['commands']['ask']['flags'] };
  const commands = {
    ask,
  };
  const input: ProviderConfig['input'] = { method: 'flag' };
  const providerConfig: ProviderConfig = {
    enabled: true,
    description: 'Test provider',
    command: 'test-cli',
    timeout: 120000,
    env: {},
    outputFormat: 'json',
    commands,
    input,
  };

  return providerConfig;
};

const withSessions = (config: ProviderConfig): ProviderConfig => {
  const flags = { resume: ['--resume'] };
  const sessions = { flags };
  const commands = { ...config.commands, sessions };
  const providerConfig: ProviderConfig = {
    ...config,
    commands,
  };

  return providerConfig;
};

describe('buildAskToolDefinition wave 3 provider config shapes', () => {
  describe('wave 3a', () => {
    it('GIVEN aider style config WHEN building tool definition THEN model is present but session_id is absent', () => {
      const baseConfig = createConfig({ model: '--model' });
      const config = {
        ...baseConfig,
        outputFormat: 'text',
      } satisfies ProviderConfig;
      const result = buildAskToolDefinition('aider', config);

      expect(result.inputSchema).toHaveProperty('model');
      expect(result.inputSchema).not.toHaveProperty('session_id');
      expect(result.inputSchema).not.toHaveProperty('auto_mode');
    });

    it('GIVEN goose style config WHEN building tool definition THEN model and session_id are both present', () => {
      const config = withSessions(createConfig({ model: '--model' }));
      const result = buildAskToolDefinition('goose', config);

      expect(result.inputSchema).toHaveProperty('model');
      expect(result.inputSchema).toHaveProperty('session_id');
      expect(result.inputSchema).not.toHaveProperty('auto_mode');
    });

    it('GIVEN amp style config WHEN building tool definition THEN auto_mode is present for dangerous allow all', () => {
      const baseConfig = createConfig({ autoMode: ['--dangerously-allow-all'] });
      const input: ProviderConfig['input'] = { method: 'stdin' };
      const config = {
        ...baseConfig,
        outputFormat: 'stream-json',
        input,
      } satisfies ProviderConfig;
      const result = buildAskToolDefinition('amp', config);

      expect(result.inputSchema).toHaveProperty('auto_mode');
      expect(result.inputSchema?.auto_mode?.parse(true)).toBe(true);
      expect(result.inputSchema).not.toHaveProperty('session_id');
    });
  });

  describe('wave 3b', () => {
    it('GIVEN cline style config WHEN building tool definition THEN only the standard fields are present', () => {
      const baseConfig = createConfig({});
      const input: ProviderConfig['input'] = { method: 'positional' };
      const config = {
        ...baseConfig,
        outputFormat: 'stream-json',
        input,
      } satisfies ProviderConfig;
      const result = buildAskToolDefinition('cline', config);

      expect(result.inputSchema).not.toHaveProperty('model');
      expect(result.inputSchema).not.toHaveProperty('working_directory');
      expect(result.inputSchema).not.toHaveProperty('sandbox');
      expect(result.inputSchema).not.toHaveProperty('session_id');
    });

    it('GIVEN cursor style config WHEN building tool definition THEN model, working_directory, and sandbox are present', () => {
      const sandbox = { flag: '--sandbox', values: ['enabled', 'disabled'] };
      const baseConfig = createConfig({
        model: '--model',
        workingDir: '--workspace',
        sandbox,
      });
      const input: ProviderConfig['input'] = { method: 'flag' };
      const config = {
        ...baseConfig,
        outputFormat: 'json',
        input,
      } satisfies ProviderConfig;
      const result = buildAskToolDefinition('cursor', config);

      expect(result.inputSchema).toHaveProperty('model');
      expect(result.inputSchema).toHaveProperty('working_directory');
      expect(result.inputSchema).toHaveProperty('sandbox');
    });

    it('GIVEN droid style config WHEN building tool definition THEN model and working_directory are present', () => {
      const baseConfig = createConfig({ model: '-m', workingDir: '--cwd' });
      const input: ProviderConfig['input'] = { method: 'positional' };
      const config = {
        ...baseConfig,
        outputFormat: 'json',
        input,
      } satisfies ProviderConfig;
      const result = buildAskToolDefinition('droid', config);

      expect(result.inputSchema).toHaveProperty('model');
      expect(result.inputSchema).toHaveProperty('working_directory');
      expect(result.inputSchema).not.toHaveProperty('sandbox');
      expect(result.inputSchema).not.toHaveProperty('session_id');
    });
  });
});
