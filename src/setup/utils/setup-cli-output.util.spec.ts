import { describe, expect, it, vi } from 'vitest';

import {
  formatHumanMinimalSetupOutput,
  formatHumanSetupOutput,
  formatJsonMinimalSetupOutput,
  formatJsonSetupOutput,
  formatProviderSummary,
  formatSkillOutput,
  isNonInteractiveWriteBlocked,
  readExistingConfigText,
} from './setup-cli-output.util';
import type { DetectedProvider, ParsedSetupArgs, SetupApplyResult, SetupPlan } from '../common';

const createArgs = (overrides: Partial<ParsedSetupArgs> = {}): ParsedSetupArgs => {
  const args: ParsedSetupArgs = {
    client: 'claude-code',
    dryRun: false,
    yes: false,
    output: 'human',
    mode: 'merge',
    pathOverride: undefined,
    backup: 'if-exists',
    minimal: false,
    ...overrides,
  };

  return args;
};

const createPlan = (overrides: Partial<SetupPlan> = {}): SetupPlan => {
  const plan: SetupPlan = {
    client: 'claude-code',
    mode: 'merge',
    backup: 'if-exists',
    dryRun: false,
    writeIntent: 'write',
    targetPath: '/tmp/mcp.json',
    mergeStatusPreview: 'merged',
    configText: '{"mcpServers":{"agentic-mcp":{"command":"npx","args":["-y","agentic-mcp"]}}}\n',
    warnings: [],
    ...overrides,
  };

  return plan;
};

const createApplyResult = (overrides: Partial<SetupApplyResult> = {}): SetupApplyResult => {
  const result: SetupApplyResult = {
    status: 'written',
    path: '/tmp/mcp.json',
    backupPath: undefined,
    ...overrides,
  };

  return result;
};

const createProvider = (overrides: Partial<DetectedProvider> = {}): DetectedProvider => {
  const provider: DetectedProvider = {
    name: 'claude',
    available: true,
    binaryPath: '/usr/bin/claude',
    ...overrides,
  };

  return provider;
};

describe('setup-cli-output utilities', () => {
  it('GIVEN detected providers WHEN formatting summary THEN includes availability status per provider', () => {
    const output = formatProviderSummary([
      createProvider({ name: 'claude', available: true, binaryPath: '/usr/bin/claude' }),
      createProvider({ name: 'codex', available: false, binaryPath: undefined }),
    ]);

    expect(output).toContain('  claude: ✓ /usr/bin/claude');
    expect(output).toContain('  codex: ✗ not found');
  });

  it('GIVEN undefined target path WHEN reading existing config THEN returns undefined without file read', async () => {
    const readConfigFile = vi.fn().mockResolvedValue('{"ok":true}');

    const result = await readExistingConfigText(undefined, readConfigFile);

    expect(result).toBeUndefined();
    expect(readConfigFile).not.toHaveBeenCalled();
  });

  it('GIVEN read failure WHEN reading existing config THEN returns undefined', async () => {
    const readConfigFile = vi.fn(() => {
      throw new Error('missing file');
    });

    const result = await readExistingConfigText('/tmp/mcp.json', readConfigFile);

    expect(result).toBeUndefined();
  });

  it('GIVEN setup args plan and result WHEN formatting json output THEN returns parseable contract', () => {
    const output = formatJsonSetupOutput(
      createArgs({ output: 'json', backup: 'always' }),
      createPlan({ warnings: ['warn-1'] }),
      createApplyResult({ backupPath: '/tmp/mcp.json.bak' }),
      [createProvider({ name: 'claude' })]
    );

    const parsed = JSON.parse(output) as {
      client: string;
      backup: string;
      warnings: readonly string[];
      result: { backupPath?: string };
      providers: readonly { name: string }[];
    };

    expect(parsed.client).toBe('claude-code');
    expect(parsed.backup).toBe('always');
    expect(parsed.warnings).toStrictEqual(['warn-1']);
    expect(parsed.result.backupPath).toBe('/tmp/mcp.json.bak');
    expect(parsed.providers[0]?.name).toBe('claude');
  });

  it('GIVEN setup args plan and result WHEN formatting human output THEN includes key sections and warnings', () => {
    const output = formatHumanSetupOutput(
      createArgs({ mode: 'overwrite', dryRun: true }),
      createPlan({
        warnings: ['Overwrite mode replaces existing config content.'],
      }),
      createApplyResult({
        status: 'verification-failed',
        reason: 'Written config must include mcpServers',
      }),
      [createProvider({ name: 'claude' })]
    );

    expect(output).toContain('agentic-mcp setup');
    expect(output).toContain('Mode: overwrite');
    expect(output).toContain('Dry-run: true');
    expect(output).toContain('Detected providers:');
    expect(output).toContain('Warnings:');
    expect(output).toContain('Result: verification-failed');
    expect(output).toContain('Reason: Written config must include mcpServers');
  });

  it('GIVEN minimal setup inputs WHEN formatting human output THEN it includes skill status and next steps', () => {
    const output = formatHumanMinimalSetupOutput({
      client: 'claude-code',
      detectedProviders: [createProvider({ name: 'claude' })],
      skillResult: {
        status: 'installed',
        skillPath: '/home/.claude/skills/using-agentic-mcp/SKILL.md',
      },
    });

    expect(output).toContain('agentic-mcp init');
    expect(output).toContain('Detected providers:');
    expect(output).toContain('Skill installed: /home/.claude/skills/using-agentic-mcp/SKILL.md');
    expect(output).toContain('npx agentic-mcp setup --client claude-code --yes');
  });

  it('GIVEN minimal setup inputs WHEN formatting json output THEN it returns parseable next steps', () => {
    const output = formatJsonMinimalSetupOutput({
      client: 'cursor',
      detectedProviders: [createProvider({ name: 'claude' })],
      skillResult: {
        status: 'already-exists',
        skillPath: '/home/.claude/skills/using-agentic-mcp/SKILL.md',
      },
    });

    const parsed = JSON.parse(output) as {
      mode: string;
      client: string;
      nextSteps: readonly string[];
      skillResult: { status: string };
    };

    expect(parsed.mode).toBe('minimal');
    expect(parsed.client).toBe('cursor');
    expect(parsed.skillResult.status).toBe('already-exists');
    expect(parsed.nextSteps).toContain('npx agentic-mcp setup --client cursor --yes');
  });

  it('GIVEN non-interactive write without --yes WHEN checking block THEN returns true', () => {
    const result = isNonInteractiveWriteBlocked(
      createArgs({ yes: false }),
      createPlan({ writeIntent: 'write' }),
      false
    );

    expect(result).toBe(true);
  });

  it('GIVEN non-interactive write with --yes WHEN checking block THEN returns false', () => {
    const result = isNonInteractiveWriteBlocked(createArgs({ yes: true }), createPlan({ writeIntent: 'write' }), false);

    expect(result).toBe(false);
  });

  it('GIVEN installed status WHEN formatting skill output THEN includes skill path', () => {
    const output = formatSkillOutput({
      status: 'installed',
      skillPath: '/home/.claude/skills/using-agentic-mcp/SKILL.md',
    });

    expect(output).toContain('Skill installed:');
    expect(output).toContain('/home/.claude/skills/using-agentic-mcp/SKILL.md');
  });

  it('GIVEN already-exists status WHEN formatting skill output THEN includes up to date message', () => {
    const output = formatSkillOutput({
      status: 'already-exists',
      skillPath: '/home/.claude/skills/using-agentic-mcp/SKILL.md',
    });

    expect(output).toContain('Skill already up to date:');
  });

  it('GIVEN error status WHEN formatting skill output THEN includes reason', () => {
    const output = formatSkillOutput({
      status: 'error',
      skillPath: '/home/.claude/skills/using-agentic-mcp/SKILL.md',
      reason: 'EACCES: permission denied',
    });

    expect(output).toContain('Skill install failed:');
    expect(output).toContain('EACCES: permission denied');
  });
});
