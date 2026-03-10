import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { McpServerEntry, SetupApplyResult, SetupPlan } from '../common';
import type { SetupCliDependencies } from '../utils';

const mocks = vi.hoisted(() => {
  const close = vi.fn<() => void>();
  const question = vi.fn<(question: string, callback: (answer: string) => void) => void>();
  const createInterface = vi.fn(() => ({
    question,
    close,
  }));

  return {
    close,
    question,
    createInterface,
  };
});

vi.mock('node:readline', () => ({
  createInterface: mocks.createInterface,
}));

let runSetup: (args: readonly string[], injectedDependencies?: Partial<SetupCliDependencies>) => Promise<void>;

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
    stdoutWrite: vi.fn<(text: string) => void>(),
    stderrWrite: vi.fn<(text: string) => void>(),
    isInteractive: true,
    readConfigFile: async () => Promise.resolve('{"mcpServers":{}}'),
    ...overrides,
  };

  return dependencies;
};

describe('runSetup default promptConfirm', () => {
  beforeEach(() => {
    mocks.createInterface.mockClear();
    mocks.question.mockClear();
    mocks.close.mockClear();
  });

  beforeAll(async () => {
    const setupCliModule = await import('./setup-cli');

    runSetup = setupCliModule.runSetup;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN default prompt receives yes WHEN running setup THEN it applies the plan', async () => {
    const applySetupPlan = vi.fn<SetupCliDependencies['applySetupPlan']>().mockResolvedValue(createApplyResult());
    const dependencies = createDependencies({
      applySetupPlan,
    });

    mocks.question.mockImplementation((_question, callback) => {
      callback('yes');
    });

    await runSetup([], dependencies);

    expect(mocks.createInterface).toHaveBeenCalledTimes(1);
    expect(mocks.question).toHaveBeenCalledWith(
      'Write config to /tmp/claude_desktop_config.json? [y/N] ',
      expect.any(Function)
    );
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(applySetupPlan).toHaveBeenCalledTimes(1);
  });

  it('GIVEN default prompt receives no WHEN running setup THEN it aborts without applying the plan', async () => {
    const stdoutWrite = vi.fn<(text: string) => void>();
    const applySetupPlan = vi.fn<SetupCliDependencies['applySetupPlan']>().mockResolvedValue(createApplyResult());
    const dependencies = createDependencies({
      stdoutWrite,
      applySetupPlan,
    });

    mocks.question.mockImplementation((_question, callback) => {
      callback('no');
    });

    await runSetup([], dependencies);

    expect(mocks.createInterface).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(applySetupPlan).not.toHaveBeenCalled();
    expect(stdoutWrite).toHaveBeenCalledWith('Aborted. No files written.\n');
  });
});
