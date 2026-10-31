import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSetupPlan } from './plan-setup.util';
import type { McpServerEntry } from '../common';

const AGENTIC_SERVER_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

const TIMED_SERVER_ENTRY: McpServerEntry = { ...AGENTIC_SERVER_ENTRY, timeout: 4_260_000 };

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

    expect(result.targetPath).toBe(path.join('/home/dev', '.claude.json'));
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
  it('GIVEN merge mode and an existing config that is not valid JSON WHEN building plan THEN it does not write and warns', () => {
    const result = buildSetupPlan({
      client: 'cursor',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'merge',
      dryRun: false,
      existingConfigText: '{ "mcpServers": { "github": {} }, // comment\n}',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.writeIntent).toBe('manual');
    expect(result.warnings).toContainEqual(expect.stringContaining('is not valid JSON'));
  });
  it('GIVEN claude-code with an existing ~/.claude.json WHEN overwrite mode is requested THEN it does not write and warns', () => {
    const result = buildSetupPlan({
      client: 'claude-code',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'overwrite',
      dryRun: false,
      existingConfigText: '{"oauthAccount":{},"mcpServers":{}}',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.writeIntent).toBe('manual');
    expect(result.warnings).toContainEqual(expect.stringContaining('use --mode merge'));
  });
  it('GIVEN claude-code with an explicit --path WHEN overwrite mode is requested THEN the user-chosen file is written', () => {
    const result = buildSetupPlan({
      client: 'claude-code',
      homeDirectory: '/home/dev',
      pathOverride: '/tmp/mcp.json',
      mode: 'overwrite',
      dryRun: false,
      existingConfigText: '{"mcpServers":{}}',
      agenticServerEntry: AGENTIC_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.writeIntent).toBe('write');
  });

  it('GIVEN claude-code merge with a lower agentic-mcp timeout WHEN building plan THEN the plan raises it and says so', () => {
    const existingEntry = { ...AGENTIC_SERVER_ENTRY, timeout: 600_000 };
    const existingServers = { 'agentic-mcp': existingEntry };
    const existingConfig = { mcpServers: existingServers };

    const result = buildSetupPlan({
      client: 'claude-code',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'merge',
      dryRun: false,
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: TIMED_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.notes).toStrictEqual(['agentic-mcp timeout: raised from 600000 to 4260000.']);
    expect(result.configText).toContain('"timeout": 4260000');
  });

  it('GIVEN overwrite mode with a higher agentic-mcp timeout WHEN building plan THEN the generated timeout is written', () => {
    const existingEntry = { ...AGENTIC_SERVER_ENTRY, timeout: 7_200_000 };
    const existingServers = { 'agentic-mcp': existingEntry };
    const existingConfig = { mcpServers: existingServers };

    const result = buildSetupPlan({
      client: 'cursor',
      homeDirectory: '/home/dev',
      pathOverride: '/tmp/mcp.json',
      mode: 'overwrite',
      dryRun: false,
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: TIMED_SERVER_ENTRY,
      backup: 'if-exists',
    });

    expect(result.configText).not.toContain('7200000');
  });

  it('GIVEN gemini with other servers and settings WHEN building plan THEN it targets ~/.gemini/settings.json and keeps them', () => {
    const other = { command: 'node', args: ['other.js'] };
    const existingServers = { other };
    const existingConfig = { theme: 'dark', mcpServers: existingServers };

    const result = buildSetupPlan({
      client: 'gemini',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'merge',
      dryRun: false,
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: TIMED_SERVER_ENTRY,
      backup: 'if-exists',
    });
    const writtenServers = { other, 'agentic-mcp': TIMED_SERVER_ENTRY };
    const writtenConfig = { theme: 'dark', mcpServers: writtenServers };

    expect(result.targetPath).toBe(path.join('/home/dev', '.gemini/settings.json'));
    expect(JSON.parse(result.configText)).toStrictEqual(writtenConfig);
    expect(result.notes).toStrictEqual(['agentic-mcp timeout: set to 4260000 (was not set).']);
  });

  it('GIVEN copilot with a tool allow-list on agentic-mcp WHEN building plan THEN it targets ~/.copilot/mcp-config.json and keeps the list', () => {
    const userEntry = {
      type: 'local',
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
      tools: ['ask_codex'],
      timeout: 600_000,
    };
    const existingServers = { 'agentic-mcp': userEntry };
    const existingConfig = { mcpServers: existingServers };
    const copilotEntry: McpServerEntry = { ...userEntry, type: 'local', tools: ['*'], timeout: 4_260_000 };

    const result = buildSetupPlan({
      client: 'copilot',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'merge',
      dryRun: false,
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: copilotEntry,
      backup: 'if-exists',
    });
    const writtenEntry = { ...userEntry, timeout: 4_260_000 };
    const writtenServers = { 'agentic-mcp': writtenEntry };

    expect(result.targetPath).toBe(path.join('/home/dev', '.copilot/mcp-config.json'));
    expect(JSON.parse(result.configText)).toStrictEqual({ mcpServers: writtenServers });
  });

  it('GIVEN opencode with a disabled agentic-mcp entry WHEN building plan THEN it writes under mcp in the global config and keeps it disabled', () => {
    const userEntry = { type: 'local', command: ['npx', '-y', 'agentic-mcp'], enabled: false };
    const existingServers = { 'agentic-mcp': userEntry };
    const existingConfig = { $schema: 'https://opencode.ai/config.json', mcp: existingServers };
    const opencodeEntry: McpServerEntry = { ...userEntry, type: 'local', enabled: true, timeout: 4_260_000 };

    const result = buildSetupPlan({
      client: 'opencode',
      homeDirectory: '/home/dev',
      pathOverride: undefined,
      mode: 'merge',
      dryRun: false,
      existingConfigText: JSON.stringify(existingConfig),
      agenticServerEntry: opencodeEntry,
      backup: 'if-exists',
    });
    const writtenEntry = { ...userEntry, timeout: 4_260_000 };
    const writtenServers = { 'agentic-mcp': writtenEntry };
    const writtenConfig = { $schema: 'https://opencode.ai/config.json', mcp: writtenServers };

    expect(result.targetPath).toBe(path.join('/home/dev', '.config/opencode/opencode.json'));
    expect(JSON.parse(result.configText)).toStrictEqual(writtenConfig);
  });
});
