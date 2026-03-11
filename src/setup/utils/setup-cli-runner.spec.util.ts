import path from 'node:path';

import { vi } from 'vitest';
import type { Mock } from 'vitest';

import type {
  DetectedProvider,
  McpServerEntry,
  ParsedSetupArgs,
  SetupApplyResult,
  SetupCliDependencies,
  SetupPlan,
} from '../common';

export const TEST_SERVER_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

export const TEST_PROVIDERS: readonly DetectedProvider[] = [
  {
    name: 'claude',
    available: true,
    binaryPath: '/usr/bin/claude',
  },
];

export const DEFAULT_SKILL_PATH = '/home/dev/.claude/skills/using-agentic-mcp/SKILL.md';

export const DEFAULT_CLAUDE_PATH = path.join('/home/dev', '.claude', 'claude_desktop_config.json');

type TextWriterMock = Mock<(text: string) => void>;

export const createParsedSetupArgs = (overrides: Partial<ParsedSetupArgs> = {}): ParsedSetupArgs => {
  const parsedArgs: ParsedSetupArgs = {
    client: 'claude-code',
    dryRun: false,
    yes: true,
    output: 'human',
    mode: 'merge',
    pathOverride: undefined,
    backup: 'if-exists',
    minimal: false,
    ...overrides,
  };

  return parsedArgs;
};

export const createSetupPlan = (overrides: Partial<SetupPlan> = {}): SetupPlan => {
  const plan: SetupPlan = {
    client: 'claude-code',
    mode: 'merge',
    backup: 'if-exists',
    dryRun: false,
    writeIntent: 'write',
    targetPath: DEFAULT_CLAUDE_PATH,
    mergeStatusPreview: 'merged',
    configText: '{"mcpServers":{"agentic-mcp":{"command":"npx","args":["-y","agentic-mcp"]}}}\n',
    warnings: [],
    ...overrides,
  };

  return plan;
};

export const createSetupApplyResult = (overrides: Partial<SetupApplyResult> = {}): SetupApplyResult => {
  const result: SetupApplyResult = {
    status: 'written',
    path: DEFAULT_CLAUDE_PATH,
    backupPath: undefined,
    ...overrides,
  };

  return result;
};

export const createSetupCliDependencies = (overrides: Partial<SetupCliDependencies> = {}): SetupCliDependencies => {
  const dependencies: SetupCliDependencies = {
    detectInstalledProviders: async () => Promise.resolve(TEST_PROVIDERS),
    generateClientConfigEntry: () => TEST_SERVER_ENTRY,
    buildSetupPlan: () => createSetupPlan(),
    applySetupPlan: async () => Promise.resolve(createSetupApplyResult()),
    installSkill: async () => Promise.resolve({ status: 'installed', skillPath: DEFAULT_SKILL_PATH }),
    homeDirectory: '/home/dev',
    stdoutWrite: vi.fn<(text: string) => void>(),
    stderrWrite: vi.fn<(text: string) => void>(),
    isInteractive: false,
    promptConfirm: async () => Promise.resolve(false),
    readConfigFile: async () => Promise.resolve('{"mcpServers":{}}'),
    ...overrides,
  };

  return dependencies;
};

export const readStdoutOutput = (stdoutWrite: TextWriterMock): string => {
  const output = stdoutWrite.mock.calls.map((call) => call[0]).join('');

  return output;
};

export const readStdoutCallOutput = (stdoutWrite: TextWriterMock, index: number): string => {
  const output = stdoutWrite.mock.calls[index]?.[0] ?? '';

  return output;
};
