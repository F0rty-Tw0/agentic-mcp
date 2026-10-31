import { afterEach, describe, expect, it, vi } from 'vitest';

import { runConfiguredSetup } from './setup-cli-runner.util';
import type { SetupApplyResult, SetupPlan } from '../common';
import { DEFAULT_CLAUDE_PATH, DEFAULT_SKILL_PATH, TEST_PROVIDERS } from '../test/common/setup.const';
import {
  createParsedSetupArgs,
  createSetupApplyResult,
  createSetupCliDependencies,
  createSetupPlan,
  readStdoutOutput,
} from '../test/utils/setup-cli-runner.spec.util';

const SKIPPED_SKILL_LINE = 'Skill not installed: rerun with --yes to install it\n';

describe('runConfiguredSetup skill install', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GIVEN a claude-code manual plan without yes', () => {
    const buildSetupPlan = (): SetupPlan => createSetupPlan({ writeIntent: 'manual' });
    const applySetupPlan = async (): Promise<SetupApplyResult> =>
      Promise.resolve(createSetupApplyResult({ status: 'manual' }));

    it('WHEN running configured setup with human output THEN it says the skill was not installed', async () => {
      const stdoutWrite = vi.fn<(text: string) => void>();
      const dependencies = createSetupCliDependencies({ stdoutWrite, applySetupPlan, buildSetupPlan });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ client: 'claude-code', yes: false }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      const output = readStdoutOutput(stdoutWrite);

      expect(output.endsWith(SKIPPED_SKILL_LINE)).toBe(true);
    });

    it('WHEN running configured setup with json output THEN skillResult is skipped with the reason', async () => {
      const stdoutWrite = vi.fn<(text: string) => void>();
      const dependencies = createSetupCliDependencies({ stdoutWrite, applySetupPlan, buildSetupPlan });
      const expectedSkillResult = {
        status: 'skipped',
        skillPath: DEFAULT_SKILL_PATH,
        reason: 'rerun with --yes to install it',
      };

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ client: 'claude-code', yes: false, output: 'json' }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      const parsed: unknown = JSON.parse(readStdoutOutput(stdoutWrite));

      expect(parsed).toStrictEqual(expect.objectContaining({ skillResult: expectedSkillResult }));
    });
  });

  describe('GIVEN an unchanged claude-code plan without yes and an interactive terminal', () => {
    it('WHEN running configured setup THEN the prompt says the config is already there and asks about the skill', async () => {
      const promptConfirm = vi.fn().mockResolvedValue(false);
      const buildSetupPlan = (): SetupPlan => createSetupPlan({ writeIntent: 'unchanged' });
      const dependencies = createSetupCliDependencies({ promptConfirm, buildSetupPlan, isInteractive: true });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ client: 'claude-code', yes: false }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(promptConfirm).toHaveBeenCalledWith(
        `agentic-mcp is already configured in ${DEFAULT_CLAUDE_PATH}. Install the Claude Code skill? [y/N] `
      );
    });
  });
});
