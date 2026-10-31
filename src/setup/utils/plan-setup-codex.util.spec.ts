import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSetupPlan } from './plan-setup.util';
import type { CodexServerEntry, SetupMode, SetupPlan } from '../common';

const CODEX_ENTRY: CodexServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  tool_timeout_sec: 3660,
  startup_timeout_sec: 60,
};

const CODEX_TABLE_LINES = [
  '[mcp_servers.agentic-mcp]',
  'command = "npx"',
  'args = [ "-y", "agentic-mcp" ]',
  'tool_timeout_sec = 3660',
  'startup_timeout_sec = 60',
  '',
];

const CODEX_TABLE = CODEX_TABLE_LINES.join('\n');

const LOW_TIMEOUT_CONFIG = '# keep me\n[mcp_servers.agentic-mcp]\ncommand = "npx"\ntool_timeout_sec = 300\n';

const planCodex = (existingConfigText: string | undefined, mode: SetupMode = 'merge'): SetupPlan => {
  const plan = buildSetupPlan({
    client: 'codex',
    homeDirectory: '/home/dev',
    pathOverride: undefined,
    mode,
    dryRun: false,
    existingConfigText,
    agenticServerEntry: CODEX_ENTRY,
    backup: 'if-exists',
  });

  return plan;
};

describe('FEATURE: codex setup plan', () => {
  describe('GIVEN no ~/.codex/config.toml', () => {
    it('WHEN building the plan THEN it writes the agentic-mcp TOML table to ~/.codex/config.toml', () => {
      const result = planCodex(undefined);

      expect(result.targetPath).toBe(path.join('/home/dev', '.codex/config.toml'));
      expect(result.writeIntent).toBe('write');
      expect(result.configText).toBe(CODEX_TABLE);
      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('GIVEN a config.toml that is not valid TOML', () => {
    it('WHEN building the merge plan THEN nothing is written and the warning says why', () => {
      const result = planCodex('[mcp_servers\n');

      expect(result.writeIntent).toBe('manual');
      expect(result.mergeStatusPreview).toBe('invalid-toml');
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/could not be merged safely and was left unchanged \(Invalid TOML: /)
      );
    });
  });

  describe('GIVEN an agentic-mcp table with a lower tool timeout', () => {
    it('WHEN building the merge plan THEN it warns that the rewrite drops comments and formatting', () => {
      const result = planCodex(LOW_TIMEOUT_CONFIG);

      expect(result.writeIntent).toBe('write');
      expect(result.warnings).toContainEqual(expect.stringContaining('comments and formatting are not kept'));
    });
  });

  describe('GIVEN an existing config.toml and overwrite mode', () => {
    it('WHEN building the plan THEN only the agentic-mcp table is written', () => {
      const result = planCodex(LOW_TIMEOUT_CONFIG, 'overwrite');

      expect(result.configText).toBe(CODEX_TABLE);
      expect(result.warnings).not.toContainEqual(expect.stringContaining('comments and formatting'));
    });
  });
});
