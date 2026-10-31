import { describe, expect, it } from 'vitest';

import { buildSetupPlan } from './plan-setup.util';
import type { McpServerEntry, SetupEnv, SetupPlan, SupportedClient } from '../common';

const AGENTIC_SERVER_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

type EnvPlanInput = {
  readonly client: SupportedClient;
  readonly env: SetupEnv;
  readonly pathOverride?: string;
};

// Variable names are SCREAMING_CASE, which object-literal naming rules reject.
const createEnv = (entries: [string, string][]): SetupEnv => {
  const env: SetupEnv = Object.fromEntries(entries);

  return env;
};

const planWithEnv = (envPlanInput: EnvPlanInput): SetupPlan => {
  const { client, env, pathOverride } = envPlanInput;
  const plan = buildSetupPlan({
    client,
    homeDirectory: '/home/dev',
    pathOverride,
    mode: 'merge',
    dryRun: false,
    existingConfigText: undefined,
    agenticServerEntry: AGENTIC_SERVER_ENTRY,
    backup: 'if-exists',
    env,
  });

  return plan;
};

describe('FEATURE: setup plan warnings for a client config moved by an environment variable', () => {
  describe('GIVEN CODEX_HOME is set and no --path', () => {
    it('WHEN building the codex plan THEN it warns that Codex may read another file', () => {
      const env = createEnv([['CODEX_HOME', '/srv/codex']]);

      const result = planWithEnv({ client: 'codex', env });

      expect(result.warnings).toStrictEqual([
        'CODEX_HOME is set, so codex may read /srv/codex/config.toml instead of /home/dev/.codex/config.toml, which setup writes. If it does, run setup again with --path /srv/codex/config.toml.',
      ]);
    });
  });

  describe('GIVEN CODEX_HOME points at the default ~/.codex', () => {
    it('WHEN building the codex plan THEN there is no warning, since Codex reads the file setup writes', () => {
      const env = createEnv([['CODEX_HOME', '/home/dev/.codex']]);

      const result = planWithEnv({ client: 'codex', env });

      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('GIVEN CODEX_HOME is set and --path names the file', () => {
    it('WHEN building the codex plan THEN there is no warning', () => {
      const env = createEnv([['CODEX_HOME', '/srv/codex']]);

      const result = planWithEnv({ client: 'codex', env, pathOverride: '/srv/codex/config.toml' });

      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('GIVEN COPILOT_HOME is set', () => {
    it('WHEN building the copilot plan THEN it warns about COPILOT_HOME', () => {
      const env = createEnv([['COPILOT_HOME', '/srv/copilot']]);

      const result = planWithEnv({ client: 'copilot', env });

      expect(result.warnings).toContainEqual(expect.stringMatching(/^COPILOT_HOME is set, so copilot may read/));
    });
  });

  describe('GIVEN XDG_CONFIG_HOME and OPENCODE_CONFIG are set', () => {
    it('WHEN building the opencode plan THEN it warns about each variable', () => {
      const env = createEnv([
        ['XDG_CONFIG_HOME', '/srv/xdg'],
        ['OPENCODE_CONFIG', '/srv/opencode.json'],
      ]);

      const result = planWithEnv({ client: 'opencode', env });
      const variables = result.warnings.map((warning) => warning.split(' ')[0]);

      expect(variables).toStrictEqual(['OPENCODE_CONFIG', 'XDG_CONFIG_HOME']);
    });
  });

  describe('GIVEN CLAUDE_CONFIG_DIR is set', () => {
    it('WHEN building the claude-code plan THEN it warns about CLAUDE_CONFIG_DIR', () => {
      const env = createEnv([['CLAUDE_CONFIG_DIR', '/srv/claude']]);

      const result = planWithEnv({ client: 'claude-code', env });

      expect(result.warnings).toContainEqual(
        expect.stringMatching(/^CLAUDE_CONFIG_DIR is set, so claude-code may read/)
      );
    });
  });

  describe('GIVEN a variable for another client is set, or one is empty', () => {
    it('WHEN building the gemini plan THEN there is no warning', () => {
      const env = createEnv([
        ['CODEX_HOME', '/srv/codex'],
        ['XDG_CONFIG_HOME', ''],
      ]);

      const result = planWithEnv({ client: 'gemini', env });

      expect(result.warnings).toStrictEqual([]);
    });

    it('WHEN building the opencode plan with an empty XDG_CONFIG_HOME THEN there is no warning', () => {
      const env = createEnv([['XDG_CONFIG_HOME', '']]);

      const result = planWithEnv({ client: 'opencode', env });

      expect(result.warnings).toStrictEqual([]);
    });
  });
});
