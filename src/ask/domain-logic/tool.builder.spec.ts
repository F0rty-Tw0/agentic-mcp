import { describe, expect, it } from 'vitest';

import { buildAskToolDefinition, buildSessionsToolDefinition } from './tool.builder';
import type { ProviderConfig } from '../../shared/common';

type AskToolFlags = Readonly<Record<string, unknown>>;

const createConfig = (flags: AskToolFlags): ProviderConfig => ({
  enabled: true,
  description: 'Test provider',
  command: 'test-cli',
  timeout: 120000,
  env: {},
  outputFormat: 'json',
  commands: {
    ask: { args: ['-p'], flags: flags as ProviderConfig['commands']['ask']['flags'] },
  },
  input: { method: 'flag' },
});

const withSessions = (config: ProviderConfig): ProviderConfig => ({
  ...config,
  commands: { ...config.commands, sessions: { flags: { resume: ['--resume'] } } },
});

describe('buildAskToolDefinition', () => {
  describe('tool name and description', () => {
    it('GIVEN a provider name WHEN building tool definition THEN name follows ask_{provider} pattern', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('claude', config);

      expect(result.name).toBe('ask_claude');
    });

    it('GIVEN a provider config WHEN building tool definition THEN description includes provider name', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('claude', config);

      expect(result.description).toContain('claude');
    });
  });

  describe('prompt field', () => {
    it('GIVEN any provider config WHEN building tool definition THEN prompt field is always present', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('prompt');
    });

    it('GIVEN any provider config WHEN building tool definition THEN stream_live boolean field is present', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('stream_live');
      expect(result.inputSchema?.stream_live?.parse(true)).toBe(true);
    });

    it('GIVEN ask tool definition WHEN inspecting description THEN it describes outcome and attribution', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.description).toContain('answer');
      expect(result.description).toContain('attribution');
    });
  });

  describe('model flag', () => {
    it('GIVEN provider with string model flag WHEN building tool definition THEN model field is in schema', () => {
      const config = createConfig({ model: '--model' });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('model');
    });

    it('GIVEN provider without model flag WHEN building tool definition THEN model field is absent', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).not.toHaveProperty('model');
    });
  });

  describe('effort flag (leveled)', () => {
    it('GIVEN provider with leveled effort flag WHEN building tool definition THEN effort field is a z.enum', () => {
      const config = createConfig({ effort: { flag: '--effort', values: ['low', 'medium', 'high'] } });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('effort');
    });

    it('GIVEN provider with leveled effort flag WHEN building tool definition THEN effort description lists allowed values', () => {
      const config = createConfig({ effort: { flag: '--effort', values: ['low', 'medium', 'high'] } });
      const result = buildAskToolDefinition('test', config);

      const description = (result.inputSchema?.effort as { description: string }).description;

      expect(description).toContain('low');
      expect(description).toContain('medium');
      expect(description).toContain('high');
    });

    it('GIVEN provider without effort flag WHEN building tool definition THEN effort field is absent', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).not.toHaveProperty('effort');
    });

    it('GIVEN provider with string effort flag (not leveled) WHEN building tool definition THEN effort field is absent', () => {
      const config = createConfig({ effort: '--effort' });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).not.toHaveProperty('effort');
    });
  });

  describe('maxBudget flag (string)', () => {
    it('GIVEN provider with maxBudget string flag WHEN building tool definition THEN max_budget field is in schema', () => {
      const config = createConfig({ maxBudget: '--max-budget-usd' });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('max_budget');
    });

    it('GIVEN provider without maxBudget flag WHEN building tool definition THEN max_budget field is absent', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).not.toHaveProperty('max_budget');
    });
  });

  describe('systemPrompt flag (string)', () => {
    it('GIVEN provider with systemPrompt string flag WHEN building tool definition THEN system_prompt field is in schema', () => {
      const config = createConfig({ systemPrompt: '--system-prompt' });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('system_prompt');
    });

    it('GIVEN provider without systemPrompt flag WHEN building tool definition THEN system_prompt field is absent', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).not.toHaveProperty('system_prompt');
    });
  });

  describe('sandbox flag (leveled)', () => {
    it('GIVEN provider with leveled sandbox flag WHEN building tool definition THEN sandbox field is in schema', () => {
      const config = createConfig({ sandbox: { flag: '--sandbox', values: ['read-only', 'workspace-write'] } });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('sandbox');
    });

    it('GIVEN provider without sandbox flag WHEN building tool definition THEN sandbox field is absent', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).not.toHaveProperty('sandbox');
    });
  });

  describe('session_id field', () => {
    it('GIVEN provider with sessions command WHEN building tool definition THEN session_id field is in schema', () => {
      const config = withSessions(createConfig({}));
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('session_id');
    });

    it('GIVEN provider without sessions command WHEN building tool definition THEN session_id field is absent', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).not.toHaveProperty('session_id');
    });
  });

  describe('effort schema validation', () => {
    it('GIVEN effort z.enum schema WHEN parsing valid value THEN it succeeds', () => {
      const config = createConfig({ effort: { flag: '--effort', values: ['low', 'medium', 'high'] } });
      const result = buildAskToolDefinition('test', config);

      const effortSchema = result.inputSchema?.effort;

      expect(effortSchema).toBeDefined();
      expect(effortSchema?.parse('low')).toBe('low');
    });

    it('GIVEN effort z.enum schema WHEN parsing invalid value THEN it throws', () => {
      const config = createConfig({ effort: { flag: '--effort', values: ['low', 'medium', 'high'] } });
      const result = buildAskToolDefinition('test', config);

      const effortSchema = result.inputSchema?.effort;

      expect(() => effortSchema?.parse('invalid')).toThrow();
    });
  });

  describe('auto_mode flag', () => {
    it('GIVEN provider with leveled autoMode flag WHEN building tool definition THEN auto_mode is a z.enum', () => {
      const config = createConfig({
        autoMode: { flag: '--permission-mode', values: ['acceptEdits', 'dontAsk'] },
      });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('auto_mode');
      expect(result.inputSchema?.auto_mode?.parse('acceptEdits')).toBe('acceptEdits');
      expect(() => result.inputSchema?.auto_mode?.parse('invalid')).toThrow();
    });

    it('GIVEN provider with array autoMode flag WHEN building tool definition THEN auto_mode is a z.boolean', () => {
      const config = createConfig({ autoMode: ['--yolo'] });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('auto_mode');
      expect(result.inputSchema?.auto_mode?.parse(true)).toBe(true);
    });

    it('GIVEN provider without autoMode flag WHEN building tool definition THEN auto_mode is absent', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).not.toHaveProperty('auto_mode');
    });
  });

  describe('working_directory field', () => {
    it('GIVEN provider with workingDir flag WHEN building tool definition THEN working_directory field is in schema', () => {
      const config = createConfig({ workingDir: '--add-dir' });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('working_directory');
    });

    it('GIVEN provider with file flag but no workingDir flag WHEN building tool definition THEN working_directory field is still in schema', () => {
      const config = createConfig({ file: '--file' });
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).toHaveProperty('working_directory');
    });

    it('GIVEN provider without file or workingDir flags WHEN building tool definition THEN working_directory field is absent', () => {
      const config = createConfig({});
      const result = buildAskToolDefinition('test', config);

      expect(result.inputSchema).not.toHaveProperty('working_directory');
    });
  });

  describe('claude provider config', () => {
    it('GIVEN claude provider config WHEN building tool definition THEN effort, max_budget, system_prompt, auto_mode are all present', () => {
      const config = createConfig({
        model: '--model',
        effort: { flag: '--effort', values: ['low', 'medium', 'high'] },
        maxBudget: '--max-budget-usd',
        systemPrompt: '--system-prompt',
        workingDir: '--add-dir',
        autoMode: { flag: '--permission-mode', values: ['acceptEdits', 'bypassPermissions'] },
        file: null,
      });
      const result = buildAskToolDefinition('claude', config);

      expect(result.inputSchema).toHaveProperty('model');
      expect(result.inputSchema).toHaveProperty('effort');
      expect(result.inputSchema).toHaveProperty('max_budget');
      expect(result.inputSchema).toHaveProperty('system_prompt');
      expect(result.inputSchema).toHaveProperty('working_directory');
      expect(result.inputSchema).toHaveProperty('auto_mode');
    });
  });
});

describe('buildSessionsToolDefinition', () => {
  it('GIVEN provider name WHEN building sessions tool THEN tool name uses sessions_{provider}', () => {
    const definition = buildSessionsToolDefinition('claude');

    expect(definition.name).toBe('sessions_claude');
    expect(definition.annotations.readOnlyHint).toBe(true);
  });
});
