import { describe, expect, it } from 'vitest';

import {
  buildNativeSessionArgs,
  buildStartSessionArgs,
  canStartNativeSession,
  resolveStartFlagName,
} from './session-flag-args.util';
import type { CommandDef, ProviderConfig } from '../../shared';

const START_SESSION_ID = '0b7c1f9e-2d4a-4c1b-9f3e-5a6b7c8d9e0f';
const ASK_COMMAND: CommandDef = { args: [] };
const ASK_ONLY_COMMANDS: ProviderConfig['commands'] = { ask: ASK_COMMAND };

const buildCommands = (sessions?: CommandDef): ProviderConfig['commands'] => {
  if (!sessions) return ASK_ONLY_COMMANDS;

  const commands: ProviderConfig['commands'] = { ask: ASK_COMMAND, sessions };

  return commands;
};

const buildProviderConfig = (sessions?: CommandDef): ProviderConfig => {
  const input = { method: 'positional' } as const;
  const commands = buildCommands(sessions);
  const result: ProviderConfig = {
    enabled: true,
    description: 'test provider',
    command: 'test-cli',
    timeout: 30_000,
    env: {},
    outputFormat: 'text',
    commands,
    input,
  };

  return result;
};

const buildSessionsConfig = (flags: CommandDef['flags']): ProviderConfig => {
  const sessions: CommandDef = { flags };
  const result = buildProviderConfig(sessions);

  return result;
};

describe('FEATURE: session flag args', () => {
  describe('GIVEN config without sessions command', () => {
    it('WHEN building native session args THEN returns empty array', () => {
      const config = buildProviderConfig();

      const result = buildNativeSessionArgs(config, 'session-123');

      expect(result).toStrictEqual([]);
    });

    it('WHEN building start session args THEN returns empty array', () => {
      const config = buildProviderConfig();

      const result = buildStartSessionArgs(config, START_SESSION_ID);

      expect(result).toStrictEqual([]);
    });

    it('WHEN checking whether a native session can start THEN returns false', () => {
      const config = buildProviderConfig();

      const result = canStartNativeSession(config, START_SESSION_ID);

      expect(result).toBe(false);
    });
  });

  describe('GIVEN config with sessions command but no flags', () => {
    it('WHEN building native session args THEN returns empty array', () => {
      const config = buildProviderConfig({});

      const result = buildNativeSessionArgs(config, 'session-123');

      expect(result).toStrictEqual([]);
    });

    it('WHEN checking whether a native session can start THEN returns false', () => {
      const config = buildProviderConfig({});

      const result = canStartNativeSession(config, START_SESSION_ID);

      expect(result).toBe(false);
    });
  });

  describe('GIVEN resume and continue flags without a start flag', () => {
    it('WHEN checking whether a native session can start THEN returns false', () => {
      const config = buildSessionsConfig({ resume: ['--resume'], continue: ['--continue'] });

      const result = canStartNativeSession(config, START_SESSION_ID);

      expect(result).toBe(false);
    });

    it('WHEN building start session args THEN returns empty array', () => {
      const config = buildSessionsConfig({ resume: ['--resume'] });

      const result = buildStartSessionArgs(config, START_SESSION_ID);

      expect(result).toStrictEqual([]);
    });
  });

  describe('GIVEN a start flag ending in "="', () => {
    it('WHEN building start session args THEN joins flag and id into one argument', () => {
      const config = buildSessionsConfig({ startWithId: '--session-id=' });

      const result = buildStartSessionArgs(config, START_SESSION_ID);

      expect(result).toStrictEqual([`--session-id=${START_SESSION_ID}`]);
    });

    it('WHEN checking whether a native session can start THEN returns true', () => {
      const config = buildSessionsConfig({ resume: ['--resume'], startWithId: '--session-id=' });

      const result = canStartNativeSession(config, START_SESSION_ID);

      expect(result).toBe(true);
    });
  });

  it('GIVEN a start flag without a resume or continue flag WHEN checking whether a native session can start THEN returns false', () => {
    const config = buildSessionsConfig({ startWithId: '--session-id=' });

    const result = canStartNativeSession(config, START_SESSION_ID);

    expect(result).toBe(false);
  });

  it('GIVEN a start flag and a continue flag WHEN checking whether a native session can start THEN returns true', () => {
    const config = buildSessionsConfig({ continue: '--continue', startWithId: '--session-id=' });

    const result = canStartNativeSession(config, START_SESSION_ID);

    expect(result).toBe(true);
  });

  it('GIVEN a start flag as a plain value flag WHEN building start session args THEN passes flag and id as two arguments', () => {
    const config = buildSessionsConfig({ startWithId: '--session-id' });

    const result = buildStartSessionArgs(config, START_SESSION_ID);

    expect(result).toStrictEqual(['--session-id', START_SESSION_ID]);
  });

  it('GIVEN a start flag as an array WHEN building start session args THEN appends the id after all parts', () => {
    const config = buildSessionsConfig({ startWithId: ['--new', '--id'] });

    const result = buildStartSessionArgs(config, START_SESSION_ID);

    expect(result).toStrictEqual(['--new', '--id', START_SESSION_ID]);
  });

  describe('GIVEN a resume flag', () => {
    it('WHEN the flag is a string THEN returns resume flag and session id', () => {
      const config = buildSessionsConfig({ resume: '--resume' });

      const result = buildNativeSessionArgs(config, 'session-123');

      expect(result).toStrictEqual(['--resume', 'session-123']);
    });

    it('WHEN the flag ends in "=" THEN joins flag and session id into one argument', () => {
      const config = buildSessionsConfig({ resume: '--resume=' });

      const result = buildNativeSessionArgs(config, 'session-123');

      expect(result).toStrictEqual(['--resume=session-123']);
    });

    it('WHEN the flag is an array THEN returns all flag parts and session id', () => {
      const config = buildSessionsConfig({ resume: ['--resume', '--session'] });

      const result = buildNativeSessionArgs(config, 'session-123');

      expect(result).toStrictEqual(['--resume', '--session', 'session-123']);
    });

    it('WHEN a start flag is also set THEN the resume flag still wins for follow-ups', () => {
      const config = buildSessionsConfig({ resume: ['--resume'], startWithId: '--session-id=' });

      const result = buildNativeSessionArgs(config, 'session-123');

      expect(result).toStrictEqual(['--resume', 'session-123']);
    });

    it('WHEN the flag is leveled and the session id is in values THEN returns flag and session id', () => {
      const resume = { flag: '--resume', values: ['session-789', 'other-session'] };
      const config = buildSessionsConfig({ resume });

      const result = buildNativeSessionArgs(config, 'session-789');

      expect(result).toStrictEqual(['--resume', 'session-789']);
    });

    it('WHEN the flag is leveled and the session id is not in values THEN returns empty array', () => {
      const resume = { flag: '--resume', values: ['other-session'] };
      const config = buildSessionsConfig({ resume });

      const result = buildNativeSessionArgs(config, 'session-789');

      expect(result).toStrictEqual([]);
    });
  });

  it('GIVEN a continue flag but no resume flag WHEN building native session args THEN returns continue flag args', () => {
    const config = buildSessionsConfig({ continue: '--continue' });

    const result = buildNativeSessionArgs(config, 'session-456');

    expect(result).toStrictEqual(['--continue', 'session-456']);
  });

  describe('GIVEN a provider config WHEN resolving the start flag name', () => {
    it('THEN a joined start flag drops its trailing "="', () => {
      const config = buildSessionsConfig({ startWithId: '--session-id=' });

      expect(resolveStartFlagName(config)).toBe('--session-id');
    });

    it('THEN an array start flag resolves to the part before the id', () => {
      const config = buildSessionsConfig({ startWithId: ['--new', '--id'] });

      expect(resolveStartFlagName(config)).toBe('--id');
    });

    it('THEN a config without a start flag resolves to undefined', () => {
      const config = buildSessionsConfig({ resume: ['--resume'] });

      expect(resolveStartFlagName(config)).toBeUndefined();
    });
  });
});
