import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { McpServerEntry, SetupApplyResult, SetupPlan } from '../common';
import type { SetupCliDependencies } from '../utils';

const processMocks = vi.hoisted(() => {
  const stdoutWrite = vi.fn<(text: string | Uint8Array) => boolean>().mockReturnValue(true);
  const stderrWrite = vi.fn<(text: string | Uint8Array) => boolean>().mockReturnValue(true);
  const stdout = {
    isTTY: true,
    write: stdoutWrite,
  };
  const stderr = {
    write: stderrWrite,
  };
  const stdin = {
    isTTY: true,
  };

  return {
    stderr,
    stderrWrite,
    stdin,
    stdout,
    stdoutWrite,
  };
});

vi.mock('node:process', () => ({
  default: {
    stdin: processMocks.stdin,
    stdout: processMocks.stdout,
    stderr: processMocks.stderr,
  },
}));

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

const createApplyResult = (overrides: Partial<SetupApplyResult> = {}): SetupApplyResult => {
  const result: SetupApplyResult = {
    status: 'written',
    path: '/tmp/claude_desktop_config.json',
    backupPath: undefined,
    ...overrides,
  };

  return result;
};

const createDependencies = (overrides: Partial<SetupCliDependencies> = {}): Partial<SetupCliDependencies> => {
  const dependencies: Partial<SetupCliDependencies> = {
    detectInstalledProviders: async () => Promise.resolve([]),
    generateClientConfigEntry: () => TEST_SERVER_ENTRY,
    buildSetupPlan: () => createPlan(),
    applySetupPlan: async () => Promise.resolve(createApplyResult()),
    installSkill: async () =>
      Promise.resolve({
        status: 'installed',
        skillPath: '/home/dev/.claude/skills/using-agentic-mcp/SKILL.md',
      }),
    homeDirectory: '/home/dev',
    readConfigFile: async () => Promise.resolve('{"mcpServers":{}}'),
    ...overrides,
  };

  return dependencies;
};

type RunSetup = (args: readonly string[], injectedDependencies?: Partial<SetupCliDependencies>) => Promise<void>;

const loadRunSetup = async (): Promise<RunSetup> => {
  const setupCliModule = await import('./setup-cli');

  return setupCliModule.runSetup;
};

describe('runSetup default process-backed io', () => {
  beforeEach(() => {
    vi.resetModules();
    processMocks.stdin.isTTY = true;
    processMocks.stdout.isTTY = true;
    processMocks.stdoutWrite.mockClear();
    processMocks.stderrWrite.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN default non-interactive process io WHEN running setup without yes THEN it aborts using process stderr', async () => {
    processMocks.stdin.isTTY = false;

    const applySetupPlan = vi.fn<SetupCliDependencies['applySetupPlan']>().mockResolvedValue(createApplyResult());
    const runSetup = await loadRunSetup();

    await runSetup([], createDependencies({ applySetupPlan }));

    const stderrOutput = processMocks.stderrWrite.mock.calls.map((call) => String(call[0])).join('');

    expect(stderrOutput).toContain('Use --yes to run non-interactive writes.');
    expect(applySetupPlan).not.toHaveBeenCalled();
  });

  it('GIVEN default interactive process io WHEN running setup with yes THEN it writes output using process stdout', async () => {
    const applySetupPlan = vi.fn<SetupCliDependencies['applySetupPlan']>().mockResolvedValue(createApplyResult());
    const runSetup = await loadRunSetup();

    await runSetup(['--yes'], createDependencies({ applySetupPlan }));

    const stdoutOutput = processMocks.stdoutWrite.mock.calls.map((call) => String(call[0])).join('');

    expect(stdoutOutput).toContain('agentic-mcp setup');
    expect(stdoutOutput).toContain('Result: written');
    expect(applySetupPlan).toHaveBeenCalledTimes(1);
  });
});
