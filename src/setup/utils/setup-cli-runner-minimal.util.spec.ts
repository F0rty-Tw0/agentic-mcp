import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DetectedProvider } from '../common';
import {
  DEFAULT_SKILL_PATH,
  TEST_PROVIDERS,
  createParsedSetupArgs,
  createSetupCliDependencies,
  readStdoutCallOutput,
  readStdoutOutput,
} from './setup-cli-runner.spec.util';
import { runMinimalSetup } from './setup-cli-runner.util';

type MinimalJsonOutput = Readonly<{
  client: string;
  mode: string;
  nextSteps: readonly string[];
  providers: readonly DetectedProvider[];
  skillResult: Readonly<{
    status: string;
    skillPath: string;
  }>;
}>;

describe('runMinimalSetup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN generic client with human output WHEN running minimal setup THEN suggests claude-code and prints human output', async () => {
    const stdoutWrite = vi.fn<(text: string) => void>();
    const installSkill = vi.fn().mockResolvedValue({
      status: 'installed',
      skillPath: DEFAULT_SKILL_PATH,
    });
    const dependencies = createSetupCliDependencies({ stdoutWrite, installSkill });

    await runMinimalSetup({
      parsedArgs: createParsedSetupArgs({ client: 'generic', output: 'human', minimal: true }),
      dependencies,
      detectedProviders: TEST_PROVIDERS,
    });

    const output = readStdoutOutput(stdoutWrite);

    expect(installSkill).toHaveBeenCalledWith({ homeDirectory: '/home/dev' });
    expect(output).toContain('Mode: minimal');
    expect(output).toContain('Suggested client: claude-code');
    expect(output).toContain('npx agentic-mcp setup --client claude-code --yes');
  });

  it('GIVEN non-generic client with json output WHEN running minimal setup THEN prints json output for that client', async () => {
    const stdoutWrite = vi.fn<(text: string) => void>();
    const installSkill = vi.fn().mockResolvedValue({
      status: 'already-exists',
      skillPath: DEFAULT_SKILL_PATH,
    });
    const dependencies = createSetupCliDependencies({ stdoutWrite, installSkill });

    await runMinimalSetup({
      parsedArgs: createParsedSetupArgs({ client: 'cursor', output: 'json', minimal: true }),
      dependencies,
      detectedProviders: TEST_PROVIDERS,
    });

    const output = readStdoutCallOutput(stdoutWrite, 0);
    const parsed = JSON.parse(output) as MinimalJsonOutput;

    expect(parsed).toStrictEqual({
      client: 'cursor',
      mode: 'minimal',
      nextSteps: ['npx agentic-mcp setup --client cursor --yes', 'npx agentic-mcp list_providers'],
      providers: TEST_PROVIDERS,
      skillResult: {
        status: 'already-exists',
        skillPath: DEFAULT_SKILL_PATH,
      },
    });
  });
});
