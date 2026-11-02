import { describe, expect, it } from 'vitest';

import { buildSetupPlan } from './plan-setup.util';
import type { McpServerEntry, SetupPlan, SetupPlanInput, SupportedClient } from '../common';

type AgenticEntry = Readonly<Record<string, unknown>>;

const ANTIGRAVITY_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  timeoutSeconds: 4260,
};

const OPENCODE_ENTRY: McpServerEntry = {
  type: 'local',
  command: ['npx', '-y', 'agentic-mcp'],
  enabled: true,
  timeout: 4_260_000,
};

const CODEX_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  tool_timeout_sec: 4260,
  startup_timeout_sec: 60,
};

const PLAN_INPUT: SetupPlanInput = {
  client: 'antigravity',
  homeDirectory: '/home/dev',
  pathOverride: undefined,
  mode: 'merge',
  dryRun: false,
  existingConfigText: undefined,
  agenticServerEntry: ANTIGRAVITY_ENTRY,
  backup: 'if-exists',
};

const DISABLED_TRUE_WARNING =
  'The existing agentic-mcp entry is marked disabled ("disabled": true) and setup kept it that way. To re-enable it, set "disabled" to false or remove it in the client config.';

const ENABLED_FALSE_WARNING =
  'The existing agentic-mcp entry is marked disabled ("enabled": false) and setup kept it that way. To re-enable it, set "enabled" to true or remove it in the client config.';

const buildJsonConfig = (serversKey: string, agenticEntry: AgenticEntry): AgenticEntry => {
  const servers = { 'agentic-mcp': agenticEntry };
  const config = { [serversKey]: servers };

  return config;
};

const planJson = (client: SupportedClient, agenticServerEntry: McpServerEntry, existing: AgenticEntry): SetupPlan => {
  const existingConfigText = JSON.stringify(existing);
  const plan = buildSetupPlan({ ...PLAN_INPUT, client, agenticServerEntry, existingConfigText });

  return plan;
};

const parseConfigText = (plan: SetupPlan): unknown => {
  const parsed: unknown = JSON.parse(plan.configText);

  return parsed;
};

describe('FEATURE: setup keeps a disabled agentic-mcp entry disabled', () => {
  describe('GIVEN an antigravity entry with "disabled": true', () => {
    it('WHEN building the merge plan THEN the entry is updated and stays disabled', () => {
      const existing = buildJsonConfig('mcpServers', { command: 'old', disabled: true });
      const keptEntry = { ...ANTIGRAVITY_ENTRY, disabled: true };

      const result = planJson('antigravity', ANTIGRAVITY_ENTRY, existing);

      expect(parseConfigText(result)).toStrictEqual(buildJsonConfig('mcpServers', keptEntry));
    });

    it('WHEN building the merge plan THEN a warning says the entry is disabled', () => {
      const existing = buildJsonConfig('mcpServers', { ...ANTIGRAVITY_ENTRY, disabled: true });

      const result = planJson('antigravity', ANTIGRAVITY_ENTRY, existing);

      expect(result.warnings).toStrictEqual([DISABLED_TRUE_WARNING]);
    });
  });

  describe('GIVEN an antigravity entry with "disabled": false', () => {
    it('WHEN building the merge plan THEN no disabled warning is given', () => {
      const existing = buildJsonConfig('mcpServers', { ...ANTIGRAVITY_ENTRY, disabled: false });

      const result = planJson('antigravity', ANTIGRAVITY_ENTRY, existing);

      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('GIVEN an opencode entry with "enabled": false', () => {
    it('WHEN building the merge plan THEN a warning says the entry is disabled', () => {
      const existing = buildJsonConfig('mcp', { ...OPENCODE_ENTRY, enabled: false });

      const result = planJson('opencode', OPENCODE_ENTRY, existing);

      expect(result.warnings).toStrictEqual([ENABLED_FALSE_WARNING]);
    });
  });

  describe('GIVEN a codex TOML entry with enabled = false', () => {
    it('WHEN building the merge plan THEN a warning says the entry is disabled', () => {
      const existingConfigText = '[mcp_servers.agentic-mcp]\ncommand = "old"\nenabled = false\n';

      const result = buildSetupPlan({
        ...PLAN_INPUT,
        client: 'codex',
        agenticServerEntry: CODEX_ENTRY,
        existingConfigText,
      });

      expect(result.warnings).toContain(ENABLED_FALSE_WARNING);
    });
  });
});
