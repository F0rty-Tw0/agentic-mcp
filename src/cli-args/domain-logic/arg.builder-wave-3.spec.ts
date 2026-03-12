import { describe, expect, it } from 'vitest';

import { buildArgArray } from './arg.builder';
import type { ProviderConfig } from '../../shared';
import { createCliArgsConfig as createConfig } from '../common/stubs';

describe('buildArgArray wave 3 provider patterns', () => {
  describe('wave 3a', () => {
    it('GIVEN aider style config WHEN building args THEN it uses --message with trailing yes and model flag', () => {
      const config = createConfig({
        method: 'flag',
        args: ['--message'],
        trailingArgs: ['--yes'],
        flags: { model: '--model' },
      });

      const result = buildArgArray(config, { prompt: 'refactor this', model: 'sonnet' });

      expect(result.args).toStrictEqual(['--message', 'refactor this', '--model', 'sonnet', '--yes']);
      expect(result.stdinInput).toBeUndefined();
    });

    it('GIVEN goose style config WHEN building args THEN it uses run --text with json trailing args', () => {
      const config = createConfig({
        method: 'flag',
        args: ['run', '--text'],
        trailingArgs: ['--no-session', '--output-format', 'json'],
        flags: { model: '--model' },
      });

      const result = buildArgArray(config, { prompt: 'summarize repo', model: 'goose-1' });

      expect(result.args).toStrictEqual([
        'run',
        '--text',
        'summarize repo',
        '--model',
        'goose-1',
        '--no-session',
        '--output-format',
        'json',
      ]);
      expect(result.stdinInput).toBeUndefined();
    });

    it('GIVEN amp style config WHEN building args THEN it sends prompt on stdin and appends execute flags', () => {
      const config: ProviderConfig = {
        ...createConfig({
          method: 'stdin',
          args: ['--execute'],
          trailingArgs: ['--stream-json'],
          flags: { autoMode: ['--dangerously-allow-all'] },
        }),
        outputFormat: 'stream-json',
      };

      const result = buildArgArray(config, { prompt: 'ship it', auto_mode: true });

      expect(result.args).toStrictEqual(['--execute', '--dangerously-allow-all', '--stream-json']);
      expect(result.stdinInput).toBe('ship it');
      expect(result.outputFormat).toBe('stream-json');
    });
  });

  describe('wave 3b', () => {
    it('GIVEN cline style config WHEN building args THEN it keeps positional prompt between headless and json flags', () => {
      const config: ProviderConfig = {
        ...createConfig({
          method: 'positional',
          args: ['-y'],
          trailingArgs: ['--json'],
          flags: {},
        }),
        outputFormat: 'stream-json',
      };

      const result = buildArgArray(config, { prompt: 'review this diff' });

      expect(result.args).toStrictEqual(['-y', 'review this diff', '--json']);
      expect(result.outputFormat).toBe('stream-json');
    });

    it('GIVEN cursor style config WHEN building args THEN it uses print mode with model, workspace, and sandbox flags', () => {
      const config = createConfig({
        method: 'flag',
        args: ['-p'],
        trailingArgs: ['--output-format', 'json'],
        flags: {
          model: '--model',
          workingDir: '--workspace',
          sandbox: { flag: '--sandbox', values: ['enabled', 'disabled'] },
        },
      });

      const result = buildArgArray(config, {
        prompt: 'audit auth flow',
        model: 'gpt-5.2',
        working_directory: '/repo',
        sandbox: 'enabled',
      });

      expect(result.args).toStrictEqual([
        '-p',
        'audit auth flow',
        '--model',
        'gpt-5.2',
        '--workspace',
        '/repo',
        '--sandbox',
        'enabled',
        '--output-format',
        'json',
      ]);
    });

    it('GIVEN droid style config WHEN building args THEN it uses exec with model and cwd flags', () => {
      const config = createConfig({
        method: 'positional',
        args: ['exec'],
        trailingArgs: ['--output-format', 'json'],
        flags: { model: '-m', workingDir: '--cwd' },
      });

      const result = buildArgArray(config, {
        prompt: 'summarize src/server',
        model: 'claude-opus-4-6',
        working_directory: '/workspace/repo',
      });

      expect(result.args).toStrictEqual([
        'exec',
        'summarize src/server',
        '-m',
        'claude-opus-4-6',
        '--cwd',
        '/workspace/repo',
        '--output-format',
        'json',
      ]);
    });
  });
});
