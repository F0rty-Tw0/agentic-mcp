import { describe, expect, it } from 'vitest';

import { guardPromptArg, placesSessionArgsBeforePrompt } from './prompt-arg.util';
import type { CommandDef, ProviderConfig } from '../../shared/provider/common';
import { createCliArgsConfig } from '../test/utils/cli-args-config.spec.util';

const createSessionsConfig = (method: ProviderConfig['input']['method']): ProviderConfig => {
  const baseConfig = createCliArgsConfig({ method });
  const sessions: CommandDef = { placement: 'beforePrompt' };
  const commands: ProviderConfig['commands'] = { ...baseConfig.commands, sessions };
  const sessionsConfig: ProviderConfig = { ...baseConfig, commands };

  return sessionsConfig;
};

describe('guardPromptArg', () => {
  it('GIVEN a prompt without a leading dash WHEN guarding THEN it is unchanged', () => {
    const guarded = guardPromptArg('explain -v');

    expect(guarded).toBe('explain -v');
  });

  it('GIVEN a prompt with a leading dash WHEN guarding THEN a space is prepended', () => {
    const guarded = guardPromptArg('-');

    expect(guarded).toBe(' -');
  });
});

describe('placesSessionArgsBeforePrompt', () => {
  it('GIVEN positional input, beforePrompt placement and session args WHEN checking THEN returns true', () => {
    const config = createSessionsConfig('positional');

    const placesBeforePrompt = placesSessionArgsBeforePrompt(config, ['resume', 'id']);

    expect(placesBeforePrompt).toBe(true);
  });

  it('GIVEN no session args WHEN checking THEN returns false', () => {
    const config = createSessionsConfig('positional');

    const placesBeforePrompt = placesSessionArgsBeforePrompt(config, []);

    expect(placesBeforePrompt).toBe(false);
  });

  it('GIVEN flag input WHEN checking THEN returns false', () => {
    const config = createSessionsConfig('flag');

    const placesBeforePrompt = placesSessionArgsBeforePrompt(config, ['resume', 'id']);

    expect(placesBeforePrompt).toBe(false);
  });
});
