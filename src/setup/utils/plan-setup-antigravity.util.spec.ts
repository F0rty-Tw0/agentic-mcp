import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSetupPlan } from './plan-setup.util';
import type { McpServerEntry, SetupEnv, SetupPlan, SetupPlanInput } from '../common';

const ANTIGRAVITY_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  timeoutSeconds: 4260,
};

const ANTIGRAVITY_PATH = path.join('/home/dev', '.gemini/config/mcp_config.json');

const DOCS_SERVER = { command: 'docs-mcp', args: ['--stdio'] };

const AGENTIC_ONLY_SERVERS = { 'agentic-mcp': ANTIGRAVITY_ENTRY };

const CONFIG_DIR_ENV_ENTRIES: [string, string][] = [
  ['GEMINI_CLI_HOME', '/elsewhere'],
  ['XDG_CONFIG_HOME', '/xdg'],
];

const CONFIG_DIR_ENV: SetupEnv = Object.fromEntries(CONFIG_DIR_ENV_ENTRIES);

const ANTIGRAVITY_PLAN_INPUT: SetupPlanInput = {
  client: 'antigravity',
  homeDirectory: '/home/dev',
  pathOverride: undefined,
  mode: 'merge',
  dryRun: false,
  existingConfigText: undefined,
  agenticServerEntry: ANTIGRAVITY_ENTRY,
  backup: 'if-exists',
  env: CONFIG_DIR_ENV,
};

const planAntigravity = (existingConfigText: string | undefined): SetupPlan => {
  const plan = buildSetupPlan({ ...ANTIGRAVITY_PLAN_INPUT, existingConfigText });

  return plan;
};

const planWithAgenticEntry = (agenticEntry: Readonly<Record<string, unknown>>): SetupPlan => {
  const servers = { docs: DOCS_SERVER, 'agentic-mcp': agenticEntry };
  const existingConfig = { theme: 'dark', mcpServers: servers };
  const plan = planAntigravity(JSON.stringify(existingConfig));

  return plan;
};

const parseConfigText = (plan: SetupPlan): unknown => {
  const parsed: unknown = JSON.parse(plan.configText);

  return parsed;
};

describe('FEATURE: antigravity setup plan', () => {
  describe('GIVEN no ~/.gemini/config/mcp_config.json', () => {
    it('WHEN building the plan THEN it writes the agentic-mcp entry with timeoutSeconds to that file', () => {
      const result = planAntigravity(undefined);

      expect(result.targetPath).toBe(ANTIGRAVITY_PATH);
      expect(result.writeIntent).toBe('write');
      expect(parseConfigText(result)).toStrictEqual({ mcpServers: AGENTIC_ONLY_SERVERS });
      expect(result.notes).toStrictEqual(['agentic-mcp timeoutSeconds: set to 4260 (was not set).']);
    });

    it('WHEN config-dir variables are set THEN no moved-config warning is given, since agy documents none', () => {
      const result = planAntigravity(undefined);

      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('GIVEN an agentic-mcp entry with a lower timeoutSeconds and keys of its own', () => {
    it('WHEN building the merge plan THEN the timeout is raised and the other server, root and entry keys are kept', () => {
      const result = planWithAgenticEntry({ command: 'old', enabledTools: ['ask_claude'], timeoutSeconds: 180 });
      const keptEntry = {
        command: 'npx',
        enabledTools: ['ask_claude'],
        timeoutSeconds: 4260,
        args: ['-y', 'agentic-mcp'],
      };
      const keptServers = { docs: DOCS_SERVER, 'agentic-mcp': keptEntry };

      expect(parseConfigText(result)).toStrictEqual({ theme: 'dark', mcpServers: keptServers });
      expect(result.notes).toStrictEqual(['agentic-mcp timeoutSeconds: raised from 180 to 4260.']);
    });
  });

  describe('GIVEN an agentic-mcp entry with a higher timeoutSeconds', () => {
    it('WHEN building the merge plan THEN the user value is kept and the file is unchanged', () => {
      const result = planWithAgenticEntry({ ...ANTIGRAVITY_ENTRY, timeoutSeconds: 9000 });

      expect(result.mergeStatusPreview).toBe('unchanged');
      expect(result.notes).toStrictEqual(['agentic-mcp timeoutSeconds: kept your 9000 (not lower than 4260).']);
    });
  });

  describe('GIVEN an agentic-mcp entry with a remote serverUrl', () => {
    it('WHEN building the merge plan THEN nothing is written and the warning says to remove serverUrl', () => {
      const result = planWithAgenticEntry({ serverUrl: 'https://example.com/mcp' });

      expect(result.writeIntent).toBe('manual');
      expect(result.warnings).toStrictEqual([
        `Existing config at ${ANTIGRAVITY_PATH} was left unchanged: the agentic-mcp entry uses serverUrl (a remote server) and setup writes a local command; it will not mix the two, so remove serverUrl or replace the entry by hand.`,
      ]);
    });
  });

  describe('GIVEN an agentic-mcp entry with a remote url', () => {
    it('WHEN building the merge plan THEN nothing is written', () => {
      const result = planWithAgenticEntry({ url: 'https://example.com/mcp' });

      expect(result.writeIntent).toBe('manual');
      expect(result.mergeStatusPreview).toBe('unmergeable');
    });
  });

  describe('GIVEN a file whose root is not an object', () => {
    it('WHEN building the merge plan THEN nothing is written', () => {
      const result = planAntigravity('[]');

      expect(result.writeIntent).toBe('manual');
      expect(result.mergeStatusPreview).toBe('unmergeable');
    });
  });

  describe('GIVEN a file whose mcpServers is not an object', () => {
    it('WHEN building the merge plan THEN nothing is written', () => {
      const result = planAntigravity('{ "mcpServers": "oops" }');

      expect(result.writeIntent).toBe('manual');
      expect(result.mergeStatusPreview).toBe('unmergeable');
    });
  });

  describe('GIVEN a file with // comments and a trailing comma, which agy accepts', () => {
    it('WHEN building the merge plan THEN it is left for a manual edit, not replaced', () => {
      const result = planAntigravity(
        '{\n  // docs server\n  "mcpServers": { "docs": { "command": "docs-mcp" }, },\n}\n'
      );

      expect(result.writeIntent).toBe('manual');
      expect(result.mergeStatusPreview).toBe('invalid-json');
      expect(result.warnings).toContainEqual(expect.stringContaining('is not valid JSON and was left unchanged'));
    });
  });
});
