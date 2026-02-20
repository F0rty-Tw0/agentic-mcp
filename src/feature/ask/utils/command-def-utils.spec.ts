import { describe, expect, it } from 'vitest';

import { getAskCommand, getFlag } from './command-def-utils.ts';
import { ValidationError } from '../../../shared/common/errors/validation-error.ts';
import type { CommandDef, ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import { FLAG_AUTO_MODE, FLAG_FILE, FLAG_MODEL, FLAG_SANDBOX, FLAG_WORKING_DIR } from '../common/command-def.const.ts';

const makeProviderConfig = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  enabled: true,
  description: 'test provider',
  command: 'test-cli',
  timeout: 30_000,
  env: {},
  outputFormat: 'text',
  commands: {
    ask: { args: ['exec'] },
  },
  input: { method: 'flag' },
  ...overrides,
});

const makeCommandDef = (overrides: Partial<CommandDef> = {}): CommandDef => ({
  args: ['exec'],
  ...overrides,
});

describe('flag constants', () => {
  it('GIVEN flag constants WHEN accessed THEN have expected values', () => {
    expect(FLAG_MODEL).toBe('model');
    expect(FLAG_WORKING_DIR).toBe('workingDir');
    expect(FLAG_FILE).toBe('file');
    expect(FLAG_AUTO_MODE).toBe('autoMode');
    expect(FLAG_SANDBOX).toBe('sandbox');
  });
});

describe('getAskCommand', () => {
  it('GIVEN provider with ask command WHEN called THEN returns the ask CommandDef', () => {
    const askDef: CommandDef = { args: ['exec'], trailingArgs: ['--json'] };
    const config = makeProviderConfig({ commands: { ask: askDef } });

    const result = getAskCommand(config);

    expect(result).toBe(askDef);
  });

  it('GIVEN provider with ask and other commands WHEN called THEN returns only the ask CommandDef', () => {
    const askDef: CommandDef = { args: ['ask'] };
    const reviewDef: CommandDef = { args: ['review'] };
    const config = makeProviderConfig({ commands: { ask: askDef, review: reviewDef } });

    const result = getAskCommand(config);

    expect(result).toBe(askDef);
  });

  it('GIVEN provider with ask command with flags WHEN called THEN returns CommandDef preserving flags', () => {
    const askDef: CommandDef = {
      args: ['exec'],
      flags: { model: '-m', sandbox: { flag: '--sandbox', values: ['read-only'] } },
    };
    const config = makeProviderConfig({ commands: { ask: askDef } });

    const result = getAskCommand(config);

    expect(result.flags).toStrictEqual({ model: '-m', sandbox: { flag: '--sandbox', values: ['read-only'] } });
  });

  it('GIVEN provider missing ask command WHEN called THEN throws ValidationError', () => {
    const config = makeProviderConfig();

    // Force-remove the ask command to simulate a broken config

    delete config.commands.ask;

    expect(() => getAskCommand(config)).toThrow(ValidationError);
  });

  it('GIVEN provider missing ask command WHEN called THEN error message mentions "ask"', () => {
    const config = makeProviderConfig();

    delete config.commands.ask;

    expect(() => getAskCommand(config)).toThrow(/ask/);
  });
});

describe('getFlag', () => {
  it('GIVEN command with string flag WHEN queried by key THEN returns the string value', () => {
    const cmd = makeCommandDef({ flags: { model: '-m' } });

    const result = getFlag(cmd, 'model');

    expect(result).toBe('-m');
  });

  it('GIVEN command with array flag WHEN queried by key THEN returns the array value', () => {
    const cmd = makeCommandDef({ flags: { autoMode: ['--full-auto'] } });

    const result = getFlag(cmd, 'autoMode');

    expect(result).toStrictEqual(['--full-auto']);
  });

  it('GIVEN command with leveled flag WHEN queried by key THEN returns the leveled object', () => {
    const leveled = { flag: '--sandbox', values: ['read-only', 'workspace-write'] };
    const cmd = makeCommandDef({ flags: { sandbox: leveled } });

    const result = getFlag(cmd, 'sandbox');

    expect(result).toStrictEqual(leveled);
  });

  it('GIVEN command with null flag WHEN queried by key THEN returns null', () => {
    const cmd = makeCommandDef({ flags: { file: null } });

    const result = getFlag(cmd, 'file');

    expect(result).toBeNull();
  });

  it('GIVEN command with flags WHEN queried by nonexistent key THEN returns undefined', () => {
    const cmd = makeCommandDef({ flags: { model: '-m' } });

    const result = getFlag(cmd, 'nonexistent');

    expect(result).toBeUndefined();
  });

  it('GIVEN command without flags property WHEN queried THEN returns undefined', () => {
    const cmd = makeCommandDef({ flags: undefined });

    const result = getFlag(cmd, 'model');

    expect(result).toBeUndefined();
  });

  it('GIVEN command with no flags key at all WHEN queried THEN returns undefined', () => {
    const cmd: CommandDef = { args: ['exec'] };

    const result = getFlag(cmd, 'model');

    expect(result).toBeUndefined();
  });
});
