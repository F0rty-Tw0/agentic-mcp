import { describe, expect, it } from 'vitest';

import { buildArgArray } from './arg.builder';
import type { CommandDef, ProviderConfig } from '../../shared';
import { createCliArgsConfig as createConfig } from '../test/utils/cli-args-config.spec.util';

const SESSION_ARGS = ['resume', 'thread-1'];

const withSessionsCommand = (config: ProviderConfig, sessions: CommandDef): ProviderConfig => {
  const commands: ProviderConfig['commands'] = { ...config.commands, sessions };
  const sessionsConfig: ProviderConfig = { ...config, commands };

  return sessionsConfig;
};

describe('buildArgArray', () => {
  describe('native session args', () => {
    it('GIVEN no sessions placement WHEN building args with session args THEN they are appended last', () => {
      const flags = { model: '-m' };
      const config = createConfig({ args: ['run'], flags, trailingArgs: ['--json'] });

      const result = buildArgArray(config, { prompt: 'hi', model: 'gpt' }, SESSION_ARGS);

      expect(result.args).toStrictEqual(['run', 'hi', '-m', 'gpt', '--json', 'resume', 'thread-1']);
    });

    it('GIVEN beforePrompt placement and positional input WHEN building args THEN session args sit between flags and prompt', () => {
      const flags = { model: '-m' };
      const baseConfig = createConfig({ method: 'positional', args: ['exec'], flags, trailingArgs: ['--json'] });
      const sessions: CommandDef = { placement: 'beforePrompt' };
      const config = withSessionsCommand(baseConfig, sessions);

      const result = buildArgArray(config, { prompt: 'hi', model: 'gpt' }, SESSION_ARGS);

      expect(result.args).toStrictEqual(['exec', '-m', 'gpt', 'resume', 'thread-1', 'hi', '--json']);
    });

    it('GIVEN beforePrompt placement without session args WHEN building args THEN order is unchanged', () => {
      const flags = { model: '-m' };
      const baseConfig = createConfig({ method: 'positional', args: ['exec'], flags, trailingArgs: ['--json'] });
      const sessions: CommandDef = { placement: 'beforePrompt' };
      const config = withSessionsCommand(baseConfig, sessions);

      const result = buildArgArray(config, { prompt: 'hi', model: 'gpt' });

      expect(result.args).toStrictEqual(['exec', 'hi', '-m', 'gpt', '--json']);
    });

    it('GIVEN beforePrompt placement and flag input WHEN building args THEN session args are appended last', () => {
      const baseConfig = createConfig({ method: 'flag', args: ['-p'] });
      const sessions: CommandDef = { placement: 'beforePrompt' };
      const config = withSessionsCommand(baseConfig, sessions);

      const result = buildArgArray(config, { prompt: 'hi' }, SESSION_ARGS);

      expect(result.args).toStrictEqual(['-p', 'hi', 'resume', 'thread-1']);
    });
  });

  describe('prompt that starts with a dash', () => {
    it('GIVEN a prompt that looks like an option WHEN building args THEN a leading space keeps the CLI from parsing it as one', () => {
      const config = createConfig({ method: 'flag', args: ['-p'] });

      const result = buildArgArray(config, { prompt: '--version' });

      expect(result.args).toStrictEqual(['-p', ' --version']);
    });

    it('GIVEN a markdown bullet prompt WHEN building args THEN the prompt is guarded', () => {
      const config = createConfig({ method: 'positional', args: ['exec'] });

      const result = buildArgArray(config, { prompt: '- fix X\n- fix Y' });

      expect(result.args).toStrictEqual(['exec', ' - fix X\n- fix Y']);
    });

    it('GIVEN stdin input WHEN the prompt starts with a dash THEN stdin keeps the prompt unchanged', () => {
      const config = createConfig({ method: 'stdin', args: ['run'] });

      const result = buildArgArray(config, { prompt: '--version' });

      expect(result.stdinInput).toBe('--version');
    });
  });
});
