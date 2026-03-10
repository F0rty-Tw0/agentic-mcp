import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DetectedProvider } from '../common';
import {
  DEFAULT_CLAUDE_PATH,
  DEFAULT_SKILL_PATH,
  TEST_PROVIDERS,
  createParsedSetupArgs,
  createSetupApplyResult,
  createSetupCliDependencies,
  createSetupPlan,
  readStdoutCallOutput,
  readStdoutOutput,
} from './setup-cli-runner.spec.util';
import { runConfiguredSetup } from './setup-cli-runner.util';

type ConfiguredJsonOutput = Readonly<{
  backup: string;
  client: string;
  dryRun: boolean;
  mergeStatusPreview: string;
  mode: string;
  providers: readonly DetectedProvider[];
  result: Readonly<{
    path?: string;
    status: string;
  }>;
  targetPath?: string;
  warnings: readonly string[];
  writeIntent: string;
}>;

describe('runConfiguredSetup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN non-interactive write without yes WHEN running configured setup THEN aborts before applying plan', async () => {
    const stderrWrite = vi.fn<(text: string) => void>();
    const applySetupPlan = vi.fn().mockResolvedValue(createSetupApplyResult());
    const dependencies = createSetupCliDependencies({ stderrWrite, applySetupPlan, isInteractive: false });

    await runConfiguredSetup({
      parsedArgs: createParsedSetupArgs({ yes: false }),
      dependencies,
      detectedProviders: TEST_PROVIDERS,
    });

    expect(stderrWrite).toHaveBeenCalledWith(
      'Aborted: non-interactive write requires explicit --yes. Use --yes to run non-interactive writes.\n'
    );
    expect(applySetupPlan).not.toHaveBeenCalled();
  });

  it('GIVEN interactive write without yes and declined prompt WHEN running configured setup THEN aborts without applying', async () => {
    const stdoutWrite = vi.fn<(text: string) => void>();
    const applySetupPlan = vi.fn().mockResolvedValue(createSetupApplyResult());
    const promptConfirm = vi.fn().mockResolvedValue(false);
    const plan = createSetupPlan({ targetPath: '/tmp/custom.json' });
    const dependencies = createSetupCliDependencies({
      stdoutWrite,
      applySetupPlan,
      promptConfirm,
      isInteractive: true,
      buildSetupPlan: () => plan,
    });

    await runConfiguredSetup({
      parsedArgs: createParsedSetupArgs({ yes: false }),
      dependencies,
      detectedProviders: TEST_PROVIDERS,
    });

    expect(promptConfirm).toHaveBeenCalledWith('Write config to /tmp/custom.json? [y/N] ');
    expect(stdoutWrite).toHaveBeenCalledWith('Aborted. No files written.\n');
    expect(applySetupPlan).not.toHaveBeenCalled();
  });

  it('GIVEN interactive write without yes and confirmed prompt WHEN running configured setup THEN applies and prints human output without skill install for non-claude clients', async () => {
    const existingConfigText = '{"mcpServers":{"existing":{"command":"node","args":["server.js"]}}}';
    const stdoutWrite = vi.fn<(text: string) => void>();
    const promptConfirm = vi.fn().mockResolvedValue(true);
    const applySetupPlan = vi.fn().mockResolvedValue(
      createSetupApplyResult({
        path: '/tmp/override.json',
        backupPath: '/tmp/override.json.bak',
      })
    );
    const buildSetupPlan = vi.fn(() =>
      createSetupPlan({
        client: 'cursor',
        targetPath: '/tmp/override.json',
        warnings: ['existing config found'],
      })
    );
    const readConfigFile = vi.fn().mockResolvedValue(existingConfigText);
    const installSkill = vi.fn().mockResolvedValue({
      status: 'installed',
      skillPath: DEFAULT_SKILL_PATH,
    });
    const dependencies = createSetupCliDependencies({
      stdoutWrite,
      promptConfirm,
      applySetupPlan,
      buildSetupPlan,
      readConfigFile,
      installSkill,
      isInteractive: true,
    });

    await runConfiguredSetup({
      parsedArgs: createParsedSetupArgs({ client: 'cursor', yes: false, pathOverride: '/tmp/override.json' }),
      dependencies,
      detectedProviders: TEST_PROVIDERS,
    });

    expect(readConfigFile).toHaveBeenCalledWith('/tmp/override.json');
    expect(buildSetupPlan).toHaveBeenCalledWith(
      expect.objectContaining({ client: 'cursor', pathOverride: '/tmp/override.json', existingConfigText })
    );
    expect(applySetupPlan).toHaveBeenCalledTimes(1);
    expect(installSkill).not.toHaveBeenCalled();

    const output = readStdoutOutput(stdoutWrite);

    expect(output).toContain('agentic-mcp setup');
    expect(output).toContain('Client: cursor');
    expect(output).toContain('Result: written');
    expect(output).toContain('Backup: /tmp/override.json.bak');
    expect(output).toContain('Warnings:');
  });

  it('GIVEN claude-code client with json output WHEN running configured setup THEN prints json output and skill output', async () => {
    const stdoutWrite = vi.fn<(text: string) => void>();
    const installSkill = vi.fn().mockResolvedValue({
      status: 'error',
      skillPath: DEFAULT_SKILL_PATH,
      reason: 'permission denied',
    });
    const applySetupPlan = vi.fn().mockResolvedValue(createSetupApplyResult({ path: DEFAULT_CLAUDE_PATH }));
    const dependencies = createSetupCliDependencies({ stdoutWrite, installSkill, applySetupPlan });

    await runConfiguredSetup({
      parsedArgs: createParsedSetupArgs({ client: 'claude-code', output: 'json', yes: true }),
      dependencies,
      detectedProviders: TEST_PROVIDERS,
    });

    const configuredOutput = readStdoutCallOutput(stdoutWrite, 0);
    const skillOutput = readStdoutCallOutput(stdoutWrite, 1);
    const parsed = JSON.parse(configuredOutput) as ConfiguredJsonOutput;

    expect(parsed).toStrictEqual({
      backup: 'if-exists',
      client: 'claude-code',
      dryRun: false,
      mergeStatusPreview: 'merged',
      mode: 'merge',
      providers: TEST_PROVIDERS,
      result: {
        path: DEFAULT_CLAUDE_PATH,
        status: 'written',
      },
      targetPath: DEFAULT_CLAUDE_PATH,
      warnings: [],
      writeIntent: 'write',
    });
    expect(installSkill).toHaveBeenCalledWith({ homeDirectory: '/home/dev' });
    expect(skillOutput).toBe('Skill install failed: permission denied\n');
  });

  it('GIVEN generic client without path override WHEN running configured setup THEN it skips reading an existing config file', async () => {
    const readConfigFile = vi.fn().mockResolvedValue('{"mcpServers":{}}');
    const buildSetupPlan = vi.fn(() =>
      createSetupPlan({ client: 'generic', writeIntent: 'manual', targetPath: undefined })
    );
    const applySetupPlan = vi.fn().mockResolvedValue(createSetupApplyResult({ status: 'manual', path: undefined }));
    const dependencies = createSetupCliDependencies({ readConfigFile, buildSetupPlan, applySetupPlan });

    await runConfiguredSetup({
      parsedArgs: createParsedSetupArgs({ client: 'generic', yes: true }),
      dependencies,
      detectedProviders: TEST_PROVIDERS,
    });

    expect(readConfigFile).not.toHaveBeenCalled();
    expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ existingConfigText: undefined }));
  });

  it('GIVEN standard client without path override WHEN running configured setup THEN it reads the default client config path', async () => {
    const defaultCursorPath = path.join('/home/dev', '.cursor', 'mcp.json');
    const readConfigFile = vi.fn().mockResolvedValue('{"mcpServers":{}}');
    const buildSetupPlan = vi.fn(() => createSetupPlan({ client: 'cursor', targetPath: defaultCursorPath }));
    const applySetupPlan = vi.fn().mockResolvedValue(createSetupApplyResult({ path: defaultCursorPath }));
    const dependencies = createSetupCliDependencies({ readConfigFile, buildSetupPlan, applySetupPlan });

    await runConfiguredSetup({
      parsedArgs: createParsedSetupArgs({ client: 'cursor', yes: true }),
      dependencies,
      detectedProviders: TEST_PROVIDERS,
    });

    expect(readConfigFile).toHaveBeenCalledWith(defaultCursorPath);
  });
});
