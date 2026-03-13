import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runProve } from './prove-cli';
import type { DetectedProvider } from '../../setup/common';

const DEFAULT_PROVE_PROMPT = 'Reply with OK and your provider name.';

type MockDependencies = Readonly<{
  detectInstalledProviders: ReturnType<typeof vi.fn<() => Promise<readonly DetectedProvider[]>>>;
  runCli: ReturnType<
    typeof vi.fn<(subcommand: string, remainingArgs: readonly string[], configPath?: string) => Promise<void>>
  >;
  stdoutWrite: ReturnType<typeof vi.fn<(text: string) => void>>;
  stderrWrite: ReturnType<typeof vi.fn<(text: string) => void>>;
}>;

const createDetectedProvider = (overrides: Partial<DetectedProvider> = {}): DetectedProvider => ({
  name: 'claude',
  available: true,
  binaryPath: '/usr/bin/claude',
  ...overrides,
});

const createDependencies = (): MockDependencies => {
  const dependencies: MockDependencies = {
    detectInstalledProviders: vi.fn<() => Promise<readonly DetectedProvider[]>>(),
    runCli: vi.fn<(subcommand: string, remainingArgs: readonly string[], configPath?: string) => Promise<void>>(),
    stdoutWrite: vi.fn<(text: string) => void>(),
    stderrWrite: vi.fn<(text: string) => void>(),
  };

  return dependencies;
};

describe('runProve', () => {
  let mockDependencies: MockDependencies;

  beforeEach(() => {
    mockDependencies = createDependencies();
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('GIVEN one detected provider and no explicit choice WHEN proving THEN it runs the default prove ask against the first detected provider', async () => {
    mockDependencies.detectInstalledProviders.mockResolvedValue([createDetectedProvider()]);
    mockDependencies.runCli.mockResolvedValue(undefined);

    await runProve({ args: [], configPath: undefined, dependencies: mockDependencies });

    expect(mockDependencies.stdoutWrite).toHaveBeenCalledWith('Proving claude with a real ask...\n');
    expect(mockDependencies.runCli).toHaveBeenCalledWith('ask_claude', [DEFAULT_PROVE_PROMPT], undefined);
  });

  it('GIVEN an explicit provider and extra flags WHEN proving THEN it forwards the flags after the prove prompt', async () => {
    const providers = [
      createDetectedProvider({ name: 'claude' }),
      createDetectedProvider({ name: 'codex', binaryPath: '/usr/bin/codex' }),
    ];

    mockDependencies.detectInstalledProviders.mockResolvedValue(providers);
    mockDependencies.runCli.mockResolvedValue(undefined);

    await runProve({
      args: ['codex', '--context', 'Focus on correctness'],
      configPath: '/tmp/providers.json',
      dependencies: mockDependencies,
    });

    expect(mockDependencies.stdoutWrite).toHaveBeenCalledWith('Proving codex with a real ask...\n');
    expect(mockDependencies.runCli).toHaveBeenCalledWith(
      'ask_codex',
      [DEFAULT_PROVE_PROMPT, '--context', 'Focus on correctness'],
      '/tmp/providers.json'
    );
  });

  it('GIVEN no detected providers WHEN proving THEN it writes a next-step error and does not call runCli', async () => {
    mockDependencies.detectInstalledProviders.mockResolvedValue([
      createDetectedProvider({ name: 'claude', available: false, binaryPath: undefined }),
    ]);

    await runProve({ args: [], configPath: undefined, dependencies: mockDependencies });

    expect(mockDependencies.runCli).not.toHaveBeenCalled();
    expect(mockDependencies.stderrWrite).toHaveBeenCalledWith(
      'No detected provider CLI is available for prove. Next: install and authenticate a supported provider CLI, then run agentic-mcp list_providers.\n'
    );
    expect(process.exitCode).toBe(1);
  });

  it('GIVEN a requested provider that is not detected WHEN proving THEN it writes a targeted error and does not call runCli', async () => {
    mockDependencies.detectInstalledProviders.mockResolvedValue([createDetectedProvider({ name: 'claude' })]);

    await runProve({ args: ['codex'], configPath: undefined, dependencies: mockDependencies });

    expect(mockDependencies.runCli).not.toHaveBeenCalled();
    expect(mockDependencies.stderrWrite).toHaveBeenCalledWith(
      'Requested provider "codex" is not currently detected. Next: run agentic-mcp list_providers to see detected providers, or install and authenticate codex.\n'
    );
    expect(process.exitCode).toBe(1);
  });
});
