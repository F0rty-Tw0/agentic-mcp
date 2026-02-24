import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSetupPlan } from './plan-setup.util.ts';

const AGENTIC_SERVER_ENTRY = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
} as const;

describe('buildSetupPlan', () => {
  it('GIVEN claude-code client without path override WHEN building plan THEN resolves default client path', () => {
    const result = buildSetupPlan({
      client: 'claude-code',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'merge',
      dryRun: false,
      existingConfigText: undefined,
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.targetPath).toBe(path.join('/home/dev', '.claude/claude_desktop_config.json'));
    expect(result.writeIntent).toBe('write');
  });

  it('GIVEN cursor client without path override WHEN building plan THEN resolves cursor path', () => {
    const result = buildSetupPlan({
      client: 'cursor',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'merge',
      dryRun: false,
      existingConfigText: undefined,
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.targetPath).toBe(path.join('/home/dev', '.cursor/mcp.json'));
  });

  it('GIVEN generic client without path override WHEN building plan THEN uses manual write intent', () => {
    const result = buildSetupPlan({
      client: 'generic',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'merge',
      dryRun: false,
      existingConfigText: undefined,
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.targetPath).toBeUndefined();
    expect(result.writeIntent).toBe('manual');
    expect(result.warnings).toContain('No writable path for generic client. Use --path to write directly.');
  });

  it('GIVEN generic client with path override WHEN building plan THEN plans direct write', () => {
    const result = buildSetupPlan({
      client: 'generic',
      homeDirectory: '/home/dev',
      pathOverride: '/tmp/mcp.json',
      mode: 'merge',
      dryRun: false,
      existingConfigText: undefined,
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.targetPath).toBe('/tmp/mcp.json');
    expect(result.writeIntent).toBe('write');
  });

  it('GIVEN dry-run WHEN building plan THEN write intent is skip and includes preview metadata', () => {
    const result = buildSetupPlan({
      client: 'claude-code',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'merge',
      dryRun: true,
      existingConfigText: undefined,
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.writeIntent).toBe('skip');
    expect(result.mergeStatusPreview).toBe('created');
    expect(result.mode).toBe('merge');
  });

  it('GIVEN overwrite mode WHEN building plan THEN plan indicates overwrite with no merge preview', () => {
    const result = buildSetupPlan({
      client: 'claude-code',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'overwrite',
      dryRun: false,
      existingConfigText: '{"mcpServers": {"old": {"command":"node","args":["old.js"]}}}',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.mode).toBe('overwrite');
    expect(result.mergeStatusPreview).toBe('created');
    expect(result.warnings).toContain('Overwrite mode replaces existing config content.');
  });
});
