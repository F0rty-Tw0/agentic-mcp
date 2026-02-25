import { describe, expect, it, vi } from 'vitest';

import type { SetupApplyResult, SetupPlan } from './common';
import { runSetup } from './setup-cli';

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

const createApplyResult = (overrides: Partial<SetupApplyResult> = {}): SetupApplyResult => {
  const result: SetupApplyResult = {
    status: 'written',
    path: '/tmp/claude_desktop_config.json',
    backupPath: undefined,
    ...overrides,
  };

  return result;
};

describe('runSetup', () => {
  it('GIVEN CLI flags WHEN running setup THEN passes parsed options to plan builder', async () => {
    const buildSetupPlan = vi.fn(() => createPlan());
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult());

    await runSetup(
      ['--client', 'cursor', '--mode', 'overwrite', '--path', '/tmp/custom.json', '--backup', 'always', '--yes'],
      {
        detectInstalledProviders: vi.fn().mockResolvedValue([]),
        generateClientConfigEntry: vi.fn(() => ({
          command: 'npx',
          args: ['-y', 'agentic-mcp'],
        })),
        buildSetupPlan,
        applySetupPlan,
        homeDirectory: '/home/dev',
        stdoutWrite: vi.fn(),
        stderrWrite: vi.fn(),
        isInteractive: false,
      }
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

    await runSetup(['--output', 'json', '--dry-run'], {
      detectInstalledProviders: vi.fn().mockResolvedValue([]),
      generateClientConfigEntry: vi.fn(() => ({
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      })),
      buildSetupPlan: vi.fn(() =>
        createPlan({
          dryRun: true,
          writeIntent: 'skip',
          mergeStatusPreview: 'created',
        })
      ),
      applySetupPlan: vi.fn().mockResolvedValue(createApplyResult({ status: 'skipped', path: undefined })),
      homeDirectory: '/home/dev',
      stdoutWrite,
      stderrWrite: vi.fn(),
      isInteractive: false,
    });

    const output = stdoutWrite.mock.calls.map((call) => call[0]).join('');
    const parsed = JSON.parse(output) as { mode: string; dryRun: boolean; result: { status: string } };

    expect(parsed.mode).toBe('merge');
    expect(parsed.dryRun).toBe(true);
    expect(parsed.result.status).toBe('skipped');
  });

  it('GIVEN non-interactive terminal without --yes WHEN write is needed THEN aborts without writing', async () => {
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult());
    const stderrWrite = vi.fn<(message: string) => void>();

    await runSetup([], {
      detectInstalledProviders: vi.fn().mockResolvedValue([]),
      generateClientConfigEntry: vi.fn(() => ({
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      })),
      buildSetupPlan: vi.fn(() => createPlan()),
      applySetupPlan,
      homeDirectory: '/home/dev',
      stdoutWrite: vi.fn(),
      stderrWrite,
      isInteractive: false,
    });

    expect(applySetupPlan).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Use --yes to run non-interactive writes.'));
  });

  it('GIVEN non-interactive dry-run without --yes WHEN running setup THEN dry-run still executes', async () => {
    const applySetupPlan = vi.fn().mockResolvedValue(createApplyResult({ status: 'skipped', path: undefined }));

    await runSetup(['--dry-run'], {
      detectInstalledProviders: vi.fn().mockResolvedValue([]),
      generateClientConfigEntry: vi.fn(() => ({
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      })),
      buildSetupPlan: vi.fn(() =>
        createPlan({
          dryRun: true,
          writeIntent: 'skip',
        })
      ),
      applySetupPlan,
      homeDirectory: '/home/dev',
      stdoutWrite: vi.fn(),
      stderrWrite: vi.fn(),
      isInteractive: false,
    });

    expect(applySetupPlan).toHaveBeenCalledTimes(1);
  });
});
