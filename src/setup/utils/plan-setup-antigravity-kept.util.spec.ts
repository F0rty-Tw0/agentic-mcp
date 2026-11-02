import { describe, expect, it } from 'vitest';

import { buildSetupPlan } from './plan-setup.util';
import type { McpServerEntry, SetupPlan, SetupPlanInput } from '../common';

const ANTIGRAVITY_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  timeoutSeconds: 4260,
};

const ANTIGRAVITY_PLAN_INPUT: SetupPlanInput = {
  client: 'antigravity',
  homeDirectory: '/home/dev',
  pathOverride: undefined,
  mode: 'merge',
  dryRun: false,
  existingConfigText: undefined,
  agenticServerEntry: ANTIGRAVITY_ENTRY,
  backup: 'if-exists',
};

const NON_POSITIVE_WARNING =
  'agentic-mcp timeoutSeconds: kept your -1. The client does not document what 0 or a negative value means (it may mean no limit), so setup leaves it; if the client stops long provider runs, set timeoutSeconds to at least 4260.';

type AgenticEntry = Readonly<Record<string, unknown>>;

const buildAgyConfig = (agenticEntry: AgenticEntry): AgenticEntry => {
  const servers = { 'agentic-mcp': agenticEntry };
  const config = { mcpServers: servers };

  return config;
};

const planWithAgenticEntry = (agenticEntry: AgenticEntry): SetupPlan => {
  const existingConfig = buildAgyConfig(agenticEntry);
  const existingConfigText = JSON.stringify(existingConfig);
  const plan = buildSetupPlan({ ...ANTIGRAVITY_PLAN_INPUT, existingConfigText });

  return plan;
};

const parseConfigText = (plan: SetupPlan): unknown => {
  const parsed: unknown = JSON.parse(plan.configText);

  return parsed;
};

describe('FEATURE: antigravity setup plan keeps what the user chose', () => {
  describe('GIVEN an agentic-mcp entry with timeoutSeconds -1', () => {
    it('WHEN building the merge plan THEN the -1 is kept and the file is unchanged', () => {
      const keptEntry = { ...ANTIGRAVITY_ENTRY, timeoutSeconds: -1 };
      const result = planWithAgenticEntry(keptEntry);

      expect(result.mergeStatusPreview).toBe('unchanged');
      expect(parseConfigText(result)).toStrictEqual(buildAgyConfig(keptEntry));
    });

    it('WHEN building the merge plan THEN a warning says it was kept and why', () => {
      const result = planWithAgenticEntry({ ...ANTIGRAVITY_ENTRY, timeoutSeconds: -1 });

      expect(result.warnings).toStrictEqual([NON_POSITIVE_WARNING]);
    });
  });

  describe('GIVEN an agentic-mcp entry with timeoutSeconds 0', () => {
    it('WHEN building the merge plan THEN the 0 is kept with a note', () => {
      const result = planWithAgenticEntry({ ...ANTIGRAVITY_ENTRY, timeoutSeconds: 0 });

      expect(result.mergeStatusPreview).toBe('unchanged');
      expect(result.notes).toContain('agentic-mcp timeoutSeconds: kept your 0 (0 or below; see the warning).');
    });
  });

  describe('GIVEN an agentic-mcp entry with a lower positive timeoutSeconds', () => {
    it('WHEN building the merge plan THEN it is still raised without a warning', () => {
      const result = planWithAgenticEntry({ ...ANTIGRAVITY_ENTRY, timeoutSeconds: 1 });

      expect(result.notes).toContain('agentic-mcp timeoutSeconds: raised from 1 to 4260.');
      expect(result.warnings).toStrictEqual([]);
    });
  });
});
