import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DetectedProvider } from '../common';
import {
  DEFAULT_SKILL_PATH,
  TEST_PROVIDERS,
  createParsedSetupArgs,
  createSetupCliDependencies,
  readStdoutCallOutput,
  readStdoutOutput,
} from './setup-cli-runner.spec.helper';
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
  summary: Readonly<{
    nextStep: Readonly<{
      command: string;
      kind: string;
      purpose: string;
    }>;
    firstProofCommand?: string;
    unproven: readonly string[];
  }>;
}>;

const FIRST_PROOF_COMMAND = 'npx agentic-mcp prove claude';

describe('runMinimalSetup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN generic client with human output WHEN running minimal setup THEN surfaces setup and first-answer next steps', async () => {
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
    expect(output).toContain('What remains unproven:');
    expect(output).toContain('Next step:');
    expect(output).toContain('npx agentic-mcp setup --client claude-code --yes');
    expect(output).toContain('First real-proof command after setup:');
    expect(output).toContain(FIRST_PROOF_COMMAND);
  });

  it('GIVEN non-generic client with json output WHEN running minimal setup THEN prints automation-friendly truthfulness fields', async () => {
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

    expect(parsed.client).toBe('cursor');
    expect(parsed.mode).toBe('minimal');
    expect(parsed.providers).toStrictEqual(TEST_PROVIDERS);
    expect(parsed.skillResult).toStrictEqual({
      status: 'already-exists',
      skillPath: DEFAULT_SKILL_PATH,
    });
    expect(parsed.nextSteps).toContain('npx agentic-mcp setup --client cursor --yes');
    expect(parsed.summary.nextStep.kind).toBe('setup');
    expect(parsed.summary.nextStep.command).toBe('npx agentic-mcp setup --client cursor --yes');
    expect(parsed.summary.firstProofCommand).toBe(FIRST_PROOF_COMMAND);
    expect(parsed.summary.unproven).toContain('MCP client configuration has not been written yet.');
  });
});
