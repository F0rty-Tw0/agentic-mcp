import { describe, expect, it, vi } from 'vitest';

import type { DetectedProvider, McpServerEntry, SetupApplyResult, SetupPlan } from '../common';
import { runSetup } from './setup-cli';

const TEST_SERVER_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

const createPlan = (overrides: Partial<SetupPlan> = {}): SetupPlan => {
  const plan: SetupPlan = {
    client: 'claude-code',
    mode: 'merge',
    backup: 'if-exists',
    dryRun: false,
    writeIntent: 'write',
    targetPath: '/tmp/claude_desktop_config.json',
    mergeStatusPreview: 'merged',
    configText: '{"mcpServers":{"agentic-mcp":{"command":"npx","args":["-y","agentic-mcp"]}}}\n',
    warnings: [],
    ...overrides,
  };

  return plan;
};

const createApplyResult = (overrides?: Partial<SetupApplyResult>): SetupApplyResult => {
  const result: SetupApplyResult = {
    status: 'written',
    path: '/tmp/claude_desktop_config.json',
    backupPath: undefined,
    ...overrides,
  };

  return result;
};

const createDependencies = (overrides?: Record<string, unknown>): Record<string, unknown> => {
  const defaults = {
    detectInstalledProviders: vi.fn().mockResolvedValue([]),
    generateClientConfigEntry: vi.fn(() => TEST_SERVER_ENTRY),
    buildSetupPlan: vi.fn(() => createPlan()),
    applySetupPlan: vi.fn().mockResolvedValue(createApplyResult()),
    homeDirectory: '/home/dev',
    stdoutWrite: vi.fn(),
    stderrWrite: vi.fn(),
    isInteractive: false,
  };

  const result = { ...defaults, ...overrides };

  return result;
};

describe('runSetup', () => {
  it('GIVEN CLI flags WHEN running setup THEN passes parsed options to plan builder', async () => {
    const buildSetupPlan = vi.fn(() => createPlan());
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult());

    await runSetup(
      ['--client', 'cursor', '--mode', 'overwrite', '--path', '/tmp/custom.json', '--backup', 'always', '--yes'],
      createDependencies({ buildSetupPlan, applySetupPlan })
    );

    expect(buildSetupPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        client: 'cursor',
        mode: 'overwrite',
        pathOverride: '/tmp/custom.json',
        backup: 'always',
      })
    );
    expect(applySetupPlan).toHaveBeenCalledTimes(1);
  });

  it('GIVEN --output json WHEN running setup THEN prints JSON contract', async () => {
    const stdoutWrite = vi.fn<(message: string) => void>();

    await runSetup(
      ['--output', 'json', '--dry-run'],
      createDependencies({
        buildSetupPlan: vi.fn(() => createPlan({ dryRun: true, writeIntent: 'skip', mergeStatusPreview: 'created' })),
        applySetupPlan: vi.fn().mockResolvedValue(createApplyResult({ status: 'skipped', path: undefined })),
        stdoutWrite,
      })
    );

    const output = stdoutWrite.mock.calls.map((call) => call[0]).join('');
    const parsed = JSON.parse(output) as { mode: string; dryRun: boolean; result: { status: string } };

    expect(parsed.mode).toBe('merge');
    expect(parsed.dryRun).toBe(true);
    expect(parsed.result.status).toBe('skipped');
  });

  it('GIVEN non-interactive terminal without --yes WHEN write is needed THEN aborts without writing', async () => {
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult());
    const stderrWrite = vi.fn<(message: string) => void>();

    await runSetup([], createDependencies({ applySetupPlan, stderrWrite }));

    expect(applySetupPlan).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Use --yes to run non-interactive writes.'));
  });

  it('GIVEN non-interactive dry-run without --yes WHEN running setup THEN dry-run still executes', async () => {
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult({ status: 'skipped', path: undefined }));

    await runSetup(
      ['--dry-run'],
      createDependencies({
        buildSetupPlan: vi.fn(() => createPlan({ dryRun: true, writeIntent: 'skip' })),
        applySetupPlan,
      })
    );

    expect(applySetupPlan).toHaveBeenCalledTimes(1);
  });

  it('GIVEN --minimal WHEN running setup THEN it installs the skill and skips config writes', async () => {
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult());
    const buildSetupPlan = vi.fn(() => createPlan());
    const generateClientConfigEntry = vi.fn(() => TEST_SERVER_ENTRY);
    const installSkill = vi.fn().mockResolvedValue({
      status: 'installed',
      skillPath: '/home/dev/.claude/skills/using-agentic-mcp/SKILL.md',
    });
    const stdoutWrite = vi.fn<(message: string) => void>();

    await runSetup(
      ['--minimal'],
      createDependencies({
        applySetupPlan,
        buildSetupPlan,
        generateClientConfigEntry,
        installSkill,
        stdoutWrite,
      })
    );

    const output = stdoutWrite.mock.calls.map((call) => call[0]).join('');

    expect(buildSetupPlan).not.toHaveBeenCalled();
    expect(generateClientConfigEntry).not.toHaveBeenCalled();
    expect(applySetupPlan).not.toHaveBeenCalled();
    expect(installSkill).toHaveBeenCalledWith({ homeDirectory: '/home/dev' });
    expect(output).toContain('agentic-mcp init');
    expect(output).toContain('Skill installed: /home/dev/.claude/skills/using-agentic-mcp/SKILL.md');
    expect(output).toContain('npx agentic-mcp setup --client claude-code --yes');
  });

  it('GIVEN interactive terminal without --yes WHEN user declines prompt THEN aborts without writing', async () => {
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult());
    const stdoutWrite = vi.fn<(message: string) => void>();
    const promptConfirm = vi.fn().mockResolvedValue(false);
    const targetPath = '/tmp/claude_desktop_config.json';

    await runSetup(
      [],
      createDependencies({
        buildSetupPlan: vi.fn(() => createPlan({ targetPath })),
        applySetupPlan,
        stdoutWrite,
        isInteractive: true,
        promptConfirm,
      })
    );

    expect(promptConfirm).toHaveBeenCalledWith(`Write config to ${targetPath}? [y/N] `);
    expect(applySetupPlan).not.toHaveBeenCalled();
    expect(stdoutWrite).toHaveBeenCalledWith('Aborted. No files written.\n');
  });

  it('GIVEN interactive terminal without --yes WHEN user confirms prompt THEN applies the plan', async () => {
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult());

    await runSetup(
      [],
      createDependencies({
        applySetupPlan,
        isInteractive: true,
        promptConfirm: vi.fn().mockResolvedValue(true),
      })
    );

    expect(applySetupPlan).toHaveBeenCalledTimes(1);
  });

  it('GIVEN interactive terminal with --yes WHEN write is needed THEN skips prompt and applies', async () => {
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult());
    const promptConfirm = vi.fn().mockResolvedValue(false);

    await runSetup(['--yes'], createDependencies({ applySetupPlan, isInteractive: true, promptConfirm }));

    expect(promptConfirm).not.toHaveBeenCalled();
    expect(applySetupPlan).toHaveBeenCalledTimes(1);
  });

  it('GIVEN default output WHEN running setup THEN prints human-readable output', async () => {
    const stdoutWrite = vi.fn<(message: string) => void>();

    await runSetup(['--yes'], createDependencies({ stdoutWrite }));

    const output = stdoutWrite.mock.calls.map((call) => call[0]).join('');

    expect(output).toContain('agentic-mcp setup');
    expect(output).toContain('Result: written');
  });

  it('GIVEN generic client without --path WHEN running setup THEN existingConfigText is undefined', async () => {
    const readConfigFile = vi.fn().mockResolvedValue('{}');
    const buildSetupPlan = vi.fn(() => createPlan({ client: 'generic', writeIntent: 'manual' }));

    await runSetup(
      ['--client', 'generic', '--yes'],
      createDependencies({
        buildSetupPlan,
        applySetupPlan: vi.fn().mockResolvedValue(createApplyResult({ status: 'manual', path: undefined })),
        readConfigFile,
      })
    );

    expect(readConfigFile).not.toHaveBeenCalled();
    expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ existingConfigText: undefined }));
  });

  it('GIVEN detected providers WHEN running setup THEN passes them to generateClientConfigEntry', async () => {
    const providers: readonly DetectedProvider[] = [
      { name: 'claude', available: true, binaryPath: '/usr/bin/claude' },
      { name: 'copilot', available: false },
    ];
    const generateClientConfigEntry = vi.fn(() => TEST_SERVER_ENTRY);

    await runSetup(
      ['--yes'],
      createDependencies({
        detectInstalledProviders: vi.fn().mockResolvedValue(providers),
        generateClientConfigEntry,
      })
    );

    expect(generateClientConfigEntry).toHaveBeenCalledWith('generic', providers);
  });

  it('GIVEN existing config file WHEN running setup THEN reads it and passes to plan builder', async () => {
    const existingConfig = '{"mcpServers":{}}';
    const readConfigFile = vi.fn().mockResolvedValue(existingConfig);
    const buildSetupPlan = vi.fn(() => createPlan());

    await runSetup(['--client', 'cursor', '--yes'], createDependencies({ buildSetupPlan, readConfigFile }));

    const calledPath = readConfigFile.mock.calls[0]?.[0] as string;

    expect(calledPath).toContain('.cursor');
    expect(calledPath).toContain('mcp.json');
    expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ existingConfigText: existingConfig }));
  });

  it('GIVEN config file does not exist WHEN running setup THEN existingConfigText is undefined', async () => {
    const readConfigFile = vi.fn().mockRejectedValue(new Error('ENOENT'));
    const buildSetupPlan = vi.fn(() => createPlan());

    await runSetup(['--client', 'cursor', '--yes'], createDependencies({ buildSetupPlan, readConfigFile }));

    expect(readConfigFile).toHaveBeenCalledTimes(1);
    expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ existingConfigText: undefined }));
  });

  it('GIVEN interactive prompt WHEN writeIntent is skip THEN skips prompt entirely', async () => {
    const promptConfirm = vi.fn().mockResolvedValue(false);
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult({ status: 'skipped', path: undefined }));

    await runSetup(
      [],
      createDependencies({
        buildSetupPlan: vi.fn(() => createPlan({ writeIntent: 'skip', dryRun: true })),
        applySetupPlan,
        isInteractive: true,
        promptConfirm,
      })
    );

    expect(promptConfirm).not.toHaveBeenCalled();
    expect(applySetupPlan).toHaveBeenCalledTimes(1);
  });

  it('GIVEN non-interactive write without injected stderr writer WHEN blocked THEN writes error to process stderr', async () => {
    const stderrWriteSpy = vi.spyOn(process.stderr, 'write');
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult());

    await runSetup(['--client', 'cursor'], {
      detectInstalledProviders: vi.fn().mockResolvedValue([]),
      generateClientConfigEntry: vi.fn(() => TEST_SERVER_ENTRY),
      buildSetupPlan: vi.fn(() => createPlan()),
      applySetupPlan,
      homeDirectory: '/home/dev',
      isInteractive: false,
    });

    const writtenText = stderrWriteSpy.mock.calls
      .map((call) => (typeof call[0] === 'string' ? call[0] : Buffer.from(call[0]).toString('utf8')))
      .join('');

    expect(writtenText).toContain('Use --yes to run non-interactive writes.');
    expect(applySetupPlan).not.toHaveBeenCalled();

    stderrWriteSpy.mockRestore();
  });

  it('GIVEN write success without injected stdout writer WHEN running setup THEN writes output to process stdout', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write');

    await runSetup(['--client', 'cursor', '--yes'], {
      detectInstalledProviders: vi.fn().mockResolvedValue([]),
      generateClientConfigEntry: vi.fn(() => TEST_SERVER_ENTRY),
      buildSetupPlan: vi.fn(() => createPlan()),
      applySetupPlan: vi.fn().mockResolvedValue(createApplyResult()),
      homeDirectory: '/home/dev',
      isInteractive: false,
    });

    const writtenText = stdoutWriteSpy.mock.calls
      .map((call) => (typeof call[0] === 'string' ? call[0] : Buffer.from(call[0]).toString('utf8')))
      .join('');

    expect(writtenText).toContain('agentic-mcp setup');
    expect(writtenText).toContain('Result: written');

    stdoutWriteSpy.mockRestore();
  });
});
