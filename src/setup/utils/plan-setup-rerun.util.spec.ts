import { describe, expect, it } from 'vitest';

import { buildSetupPlan } from './plan-setup.util';
import type { McpServerEntry, SetupPlan, SetupPlanInput } from '../common';

const AGENTIC_SERVER_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

const CONFIGURED_SERVERS = { 'agentic-mcp': AGENTIC_SERVER_ENTRY };

const CONFIGURED_TEXT = JSON.stringify({ mcpServers: CONFIGURED_SERVERS });

const planRerun = (overrides: Partial<SetupPlanInput> = {}): SetupPlan => {
  const input: SetupPlanInput = {
    client: 'claude-code',
    homeDirectory: '/home/dev',
    pathOverride: undefined,
    mode: 'merge',
    dryRun: false,
    existingConfigText: CONFIGURED_TEXT,
    agenticServerEntry: AGENTIC_SERVER_ENTRY,
    backup: 'if-exists',
    ...overrides,
  };
  const plan = buildSetupPlan(input);

  return plan;
};

describe('buildSetupPlan on a rerun', () => {
  it('GIVEN a matching entry in merge mode WHEN building plan THEN the write intent is unchanged', () => {
    const plan = planRerun();

    expect(plan.writeIntent).toBe('unchanged');
  });

  it('GIVEN a matching entry and dry-run WHEN building plan THEN the write intent stays skip', () => {
    const plan = planRerun({ dryRun: true });

    expect(plan.writeIntent).toBe('skip');
  });

  it('GIVEN a matching entry in overwrite mode WHEN building plan THEN the write intent stays write', () => {
    const plan = planRerun({ mode: 'overwrite', pathOverride: '/tmp/mcp.json' });

    expect(plan.writeIntent).toBe('write');
  });

  it('GIVEN no agentic-mcp entry yet WHEN building plan THEN the write intent is write', () => {
    const plan = planRerun({ existingConfigText: '{"mcpServers":{}}' });

    expect(plan.writeIntent).toBe('write');
  });
});
