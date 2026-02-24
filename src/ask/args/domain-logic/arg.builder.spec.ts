import { describe, expect, it } from 'vitest';

import { buildArgArray } from './arg.builder';
import type { FlagValue, ProviderConfig } from "../../../shared/common";
import { ValidationError } from "../../../shared/common/errors";
import { ASK_PROVIDER_CONFIG_STUB } from "../../common/stubs";

type AskCommandConfig = Readonly<{
  method: ProviderConfig['input']['method'];
  args: string[];
  trailingArgs: string[] | undefined;
  flags: Record<string, FlagValue>;
}>;

const DEFAULT_CONFIG_OPTIONS: AskCommandConfig = {
  method: 'positional',
  args: ['run'],
  trailingArgs: undefined,
  flags: {},
};

const createConfig = (overrides: Partial<AskCommandConfig> = {}): ProviderConfig => {
  const { method, args, trailingArgs, flags } = { ...DEFAULT_CONFIG_OPTIONS, ...overrides };

  const providerConfig: ProviderConfig = {
    ...ASK_PROVIDER_CONFIG_STUB,
    commands: {
      ask: { args, trailingArgs, flags },
    },
    input: { method },
  };

  return providerConfig;
};

describe('buildArgArray', () => {
  describe('prompt delivery', () => {
    it('GIVEN positional input method WHEN building args THEN prompt is a positional arg after command args', () => {
      const config = createConfig({ method: 'positional', args: ['exec'] });

      const result = buildArgArray(config, { prompt: 'hello world' });

      expect(result.args).toStrictEqual(['exec', 'hello world']);
      expect(result.stdinInput).toBeUndefined();
    });

    it('GIVEN flag input method WHEN building args THEN prompt follows flag prefix from args', () => {
      const config = createConfig({ method: 'flag', args: ['-p'] });

      const result = buildArgArray(config, { prompt: 'hello world' });

      expect(result.args).toStrictEqual(['-p', 'hello world']);
      expect(result.stdinInput).toBeUndefined();
    });

    it('GIVEN stdin input method WHEN building args THEN prompt is in stdinInput not in args', () => {
      const config = createConfig({ method: 'stdin', args: ['run'] });

      const result = buildArgArray(config, { prompt: 'hello world' });

      expect(result.args).toStrictEqual(['run']);
      expect(result.stdinInput).toBe('hello world');
    });
  });

  describe('validation', () => {
    it('GIVEN missing prompt WHEN building args THEN it throws ValidationError', () => {
      const config = createConfig();

      expect(() => buildArgArray(config, {})).toThrow(ValidationError);
      expect(() => buildArgArray(config, {})).toThrow('Missing required "prompt" argument');
    });

    it('GIVEN empty string prompt WHEN building args THEN it throws ValidationError', () => {
      const config = createConfig();

      expect(() => buildArgArray(config, { prompt: '' })).toThrow(ValidationError);
    });

    it('GIVEN leveled sandbox flag with invalid value WHEN building args THEN it throws ValidationError', () => {
      const config = createConfig({
        flags: {
          sandbox: { flag: '--sandbox', values: ['read-only', 'full'] },
        },
      });

      expect(() => buildArgArray(config, { prompt: 'test', sandbox: 'delete-everything' })).toThrow(ValidationError);
      expect(() => buildArgArray(config, { prompt: 'test', sandbox: 'delete-everything' })).toThrow(
        /Invalid value "delete-everything"/
      );
    });

    it('GIVEN files with non-string flag type WHEN building args THEN it throws ValidationError', () => {
      const config = createConfig({
        flags: {
          file: { flag: '--file', values: ['a.txt'] },
        },
      });

      expect(() => buildArgArray(config, { prompt: 'test', files: ['a.txt'] })).toThrow(ValidationError);
      expect(() => buildArgArray(config, { prompt: 'test', files: ['a.txt'] })).toThrow(/File flag must be/);
    });

    it('GIVEN files with array flag type WHEN building args THEN it throws ValidationError', () => {
      const config = createConfig({
        flags: {
          file: ['--file'],
        },
      });

      expect(() => buildArgArray(config, { prompt: 'test', files: ['a.txt'] })).toThrow(ValidationError);
    });
  });

  describe('optional flags', () => {
    it('GIVEN model string flag and value WHEN building args THEN flag and value are appended', () => {
      const config = createConfig({ flags: { model: '--model' } });

      const result = buildArgArray(config, { prompt: 'test', model: 'gpt-4' });

      const idx = result.args.indexOf('--model');

      expect(idx).toBeGreaterThan(-1);
      expect(result.args[idx + 1]).toBe('gpt-4');
    });

    it('GIVEN no model arg WHEN building args THEN no model flag is appended', () => {
      const config = createConfig({ flags: { model: '--model' } });

      const result = buildArgArray(config, { prompt: 'test' });

      expect(result.args).not.toContain('--model');
    });

    it('GIVEN working_directory flag and value WHEN building args THEN flag and value are appended', () => {
      const config = createConfig({ flags: { workingDir: '-C' } });

      const result = buildArgArray(config, { prompt: 'test', working_directory: '/home/user' });

      const idx = result.args.indexOf('-C');

      expect(idx).toBeGreaterThan(-1);
      expect(result.args[idx + 1]).toBe('/home/user');
    });

    it('GIVEN files array and string flag WHEN building args THEN flag is repeated per file', () => {
      const config = createConfig({ flags: { file: '--file' } });

      const result = buildArgArray(config, { prompt: 'test', files: ['a.txt', 'b.txt'] });

      expect(result.args).toStrictEqual(['run', 'test', '--file', 'a.txt', '--file', 'b.txt']);
    });

    it('GIVEN files array and null flag WHEN building args THEN files are silently skipped', () => {
      const config = createConfig({ flags: { file: null } });

      const result = buildArgArray(config, { prompt: 'test', files: ['a.txt'] });

      expect(result.args).toStrictEqual(['run', 'test']);
    });

    it('GIVEN auto_mode true and string array flag WHEN building args THEN flag elements are appended', () => {
      const config = createConfig({ flags: { autoMode: ['--full-auto'] } });

      const result = buildArgArray(config, { prompt: 'test', auto_mode: true });

      expect(result.args).toContain('--full-auto');
    });

    it('GIVEN auto_mode false WHEN building args THEN no auto flag is appended', () => {
      const config = createConfig({ flags: { autoMode: ['--full-auto'] } });

      const result = buildArgArray(config, { prompt: 'test', auto_mode: false });

      expect(result.args).not.toContain('--full-auto');
    });

    it('GIVEN sandbox string value and leveled flag WHEN building args THEN flag and value are appended', () => {
      const config = createConfig({
        flags: { sandbox: { flag: '--sandbox', values: ['read-only', 'full'] } },
      });

      const result = buildArgArray(config, { prompt: 'test', sandbox: 'read-only' });

      const idx = result.args.indexOf('--sandbox');

      expect(idx).toBeGreaterThan(-1);
      expect(result.args[idx + 1]).toBe('read-only');
    });

    it('GIVEN sandbox boolean true and leveled flag WHEN building args THEN flag is skipped (leveled flags require a value)', () => {
      const config = createConfig({
        flags: { sandbox: { flag: '--sandbox', values: ['read-only', 'full'] } },
      });

      const result = buildArgArray(config, { prompt: 'test', sandbox: true });

      expect(result.args).not.toContain('--sandbox');
    });

    it('GIVEN sandbox false WHEN building args THEN no sandbox flag is appended', () => {
      const config = createConfig({
        flags: { sandbox: { flag: '--sandbox', values: ['read-only', 'full'] } },
      });

      const result = buildArgArray(config, { prompt: 'test', sandbox: false });

      expect(result.args).not.toContain('--sandbox');
    });

    it('GIVEN sandbox value but sandbox flag not in config WHEN building args THEN silently skipped', () => {
      const config = createConfig({ flags: {} });

      const result = buildArgArray(config, { prompt: 'test', sandbox: 'read-only' });

      expect(result.args).not.toContain('--sandbox');
    });

    it('GIVEN model value but model flag is null in config WHEN building args THEN silently skipped', () => {
      const config = createConfig({ flags: { model: null } });

      const result = buildArgArray(config, { prompt: 'test', model: 'gpt-4' });

      expect(result.args).not.toContain('gpt-4');
    });
  });

  describe('trailing args', () => {
    it('GIVEN trailing args WHEN building args THEN they appear after optional flags', () => {
      const config = createConfig({
        flags: { model: '--model' },
        trailingArgs: ['--output-format', 'json'],
      });

      const result = buildArgArray(config, { prompt: 'test', model: 'gpt-4' });

      const modelIdx = result.args.indexOf('--model');
      const outputIdx = result.args.indexOf('--output-format');

      expect(outputIdx).toBeGreaterThan(modelIdx);
    });

    it('GIVEN no trailing args WHEN building args THEN only command args and flags present', () => {
      const config = createConfig({ args: ['run'] });

      const result = buildArgArray(config, { prompt: 'test' });

      expect(result.args).toStrictEqual(['run', 'test']);
    });

    it('GIVEN empty trailing args array WHEN building args THEN no trailing args appended', () => {
      const config = createConfig({ args: ['run'], trailingArgs: [] });

      const result = buildArgArray(config, { prompt: 'test' });

      expect(result.args).toStrictEqual(['run', 'test']);
    });
  });

  describe('argument ordering', () => {
    it('GIVEN full config WHEN building args THEN order is: command args, prompt, flags, trailing', () => {
      const config = createConfig({
        args: ['exec'],
        flags: { model: '--model' },
        trailingArgs: ['--json'],
      });

      const result = buildArgArray(config, { prompt: 'test', model: 'gpt-4' });

      expect(result.args).toStrictEqual(['exec', 'test', '--model', 'gpt-4', '--json']);
    });
  });

  describe('edge cases', () => {
    it('GIVEN empty command args WHEN building args THEN prompt is the first arg', () => {
      const config = createConfig({ args: [] });

      const result = buildArgArray(config, { prompt: 'test' });

      expect(result.args).toStrictEqual(['test']);
    });

    it('GIVEN no command args WHEN building args THEN prompt is the first arg', () => {
      const config = createConfig({ args: undefined });

      const result = buildArgArray(config, { prompt: 'test' });

      expect(result.args).toStrictEqual(['test']);
    });

    it('GIVEN flag not defined in command WHEN building args with that value THEN flag is skipped', () => {
      const config = createConfig({ flags: {} });

      const result = buildArgArray(config, { prompt: 'test', model: 'gpt-4' });

      expect(result.args).toStrictEqual(['run', 'test']);
    });

    it('GIVEN no flags object in command WHEN building args with values THEN values are skipped', () => {
      const config = createConfig({ flags: undefined });

      const result = buildArgArray(config, { prompt: 'test', model: 'gpt-4', auto_mode: true });

      expect(result.args).toStrictEqual(['run', 'test']);
    });
  });
});
