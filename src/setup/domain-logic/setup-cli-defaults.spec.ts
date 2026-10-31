import process from 'node:process';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SETUP_ABORTED_EXIT_CODE } from '../common';
import type { McpServerEntry, SetupApplyResult, SetupCliDependencies, SetupPlan } from '../common';

type ReadLineInterfaceMock = {
  readonly question: (question: string, callback: (answer: string) => void) => void;
  readonly close: () => void;
  readonly once: (event: string, listener: () => void) => void;
};

const mocks = vi.hoisted(() => {
  const close = vi.fn<() => void>();
  const question = vi.fn<(question: string, callback: (answer: string) => void) => void>();
  const once = vi.fn<(event: string, listener: () => void) => void>();
  const createReadLineInterface = (): ReadLineInterfaceMock => {
    const readLineInterface: ReadLineInterfaceMock = { question, close, once };

    return readLineInterface;
  };
  const createInterface = vi.fn(createReadLineInterface);
  const hoistedMocks = {
    close,
    question,
    once,
    createInterface,
  };

  return hoistedMocks;
});

vi.mock('node:readline', () => {
  const nodeReadlineModule = {
    createInterface: mocks.createInterface,
  };

  return nodeReadlineModule;
});

let runSetup: (args: string[], injectedDependencies?: Partial<SetupCliDependencies>) => Promise<void>;

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
    notes: [],
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
    installSkill: async () => {
      return Promise.resolve({
        status: 'installed',
        skillPath: '/home/dev/.claude/skills/using-agentic-mcp/SKILL.md',
      });
    },
    homeDirectory: '/home/dev',
    stdoutWrite: vi.fn<(text: string) => void>(),
    stderrWrite: vi.fn<(text: string) => void>(),
    isInteractive: true,
    readConfigFile: async () => Promise.resolve('{"mcpServers":{}}'),
    setExitCode: vi.fn<(code: number) => void>(),
    ...overrides,
  };

  return dependencies;
};

describe('runSetup default promptConfirm', () => {
  beforeEach(() => {
    mocks.createInterface.mockClear();
    mocks.question.mockClear();
    mocks.close.mockReset();
    mocks.once.mockReset();
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

  it('GIVEN the default prompt WHEN running setup THEN it asks on stderr so stdout stays for the output', async () => {
    mocks.question.mockImplementation((_question, callback) => {
      callback('no');
    });

    await runSetup([], createDependencies());

    expect(mocks.createInterface).toHaveBeenCalledWith({ input: process.stdin, output: process.stderr });
  });

  it('GIVEN the default prompt receives yes and closing fires the close event WHEN running setup THEN it still applies the plan', async () => {
    const applySetupPlan = vi.fn<SetupCliDependencies['applySetupPlan']>().mockResolvedValue(createApplyResult());
    const closeListeners: (() => void)[] = [];

    mocks.once.mockImplementation((_event, listener) => {
      closeListeners.push(listener);
    });
    mocks.close.mockImplementation(() => {
      closeListeners.forEach((listener) => {
        listener();
      });
    });
    mocks.question.mockImplementation((_question, callback) => {
      callback('yes');
    });

    await runSetup([], createDependencies({ applySetupPlan }));

    expect(applySetupPlan).toHaveBeenCalledTimes(1);
  });

  it('GIVEN the default prompt input closes before an answer WHEN running setup THEN it aborts with the aborted exit code', async () => {
    const setExitCode = vi.fn<(code: number) => void>();
    const applySetupPlan = vi.fn<SetupCliDependencies['applySetupPlan']>().mockResolvedValue(createApplyResult());

    mocks.question.mockImplementation(() => undefined);
    mocks.once.mockImplementation((event, listener) => {
      if (event === 'close') listener();
    });

    await runSetup([], createDependencies({ setExitCode, applySetupPlan }));

    expect(applySetupPlan).not.toHaveBeenCalled();
    expect(setExitCode).toHaveBeenCalledWith(SETUP_ABORTED_EXIT_CODE);
  });
});
