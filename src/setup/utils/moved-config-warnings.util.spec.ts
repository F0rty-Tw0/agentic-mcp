import { describe, expect, it } from 'vitest';

import { buildMovedConfigWarnings } from './moved-config-warnings.util';
import type { McpServerEntry, SetupEnv, SetupPlanInput } from '../common';

const OPENCODE_PATH = '/home/dev/.config/opencode/opencode.json';

const AGENTIC_SERVER_ENTRY: McpServerEntry = { command: 'npx', args: ['-y', 'agentic-mcp'] };

const createInput = (env: SetupEnv): SetupPlanInput => {
  const input: SetupPlanInput = {
    client: 'opencode',
    homeDirectory: '/home/dev',
    pathOverride: undefined,
    mode: 'merge',
    dryRun: false,
    existingConfigText: undefined,
    agenticServerEntry: AGENTIC_SERVER_ENTRY,
    backup: 'if-exists',
    env,
  };

  return input;
};

describe('FEATURE: warnings for a client config moved by an environment variable', () => {
  describe('GIVEN OPENCODE_CONFIG names a file', () => {
    it('WHEN building warnings THEN the file itself is named as the one OpenCode may read', () => {
      const env: SetupEnv = Object.fromEntries([['OPENCODE_CONFIG', '/srv/opencode.json']]);

      const result = buildMovedConfigWarnings(createInput(env), OPENCODE_PATH);

      expect(result).toStrictEqual([
        'OPENCODE_CONFIG is set, so opencode may read /srv/opencode.json instead of /home/dev/.config/opencode/opencode.json, which setup writes. If it does, run setup again with --path /srv/opencode.json.',
      ]);
    });
  });

  describe('GIVEN XDG_CONFIG_HOME is the default ~/.config', () => {
    it('WHEN building warnings THEN there is none, since OpenCode reads the file setup writes', () => {
      const env: SetupEnv = Object.fromEntries([['XDG_CONFIG_HOME', '/home/dev/.config']]);

      const result = buildMovedConfigWarnings(createInput(env), OPENCODE_PATH);

      expect(result).toStrictEqual([]);
    });
  });

  describe('GIVEN --path chooses the file', () => {
    it('WHEN OPENCODE_CONFIG names another file THEN there is no warning, since the user picked the target', () => {
      const env: SetupEnv = Object.fromEntries([['OPENCODE_CONFIG', '/srv/opencode.json']]);
      const baseInput = createInput(env);
      const input: SetupPlanInput = { ...baseInput, pathOverride: OPENCODE_PATH };

      const result = buildMovedConfigWarnings(input, OPENCODE_PATH);

      expect(result).toStrictEqual([]);
    });
  });

  describe('GIVEN no target path', () => {
    it('WHEN building warnings THEN there is none', () => {
      const env: SetupEnv = Object.fromEntries([['XDG_CONFIG_HOME', '/srv/xdg']]);

      const result = buildMovedConfigWarnings(createInput(env), undefined);

      expect(result).toStrictEqual([]);
    });
  });
});
