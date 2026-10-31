import { afterEach, describe, expect, it, vi } from 'vitest';

import { runConfiguredSetup } from './setup-cli-runner.util';
import { SETUP_ABORTED_EXIT_CODE } from '../common';
import type { SetupApplyResult, SetupCliDependencies, SetupPlan } from '../common';
import { TEST_PROVIDERS } from '../test/common/setup.const';
import {
  createParsedSetupArgs,
  createSetupCliDependencies,
  createSetupPlan,
  readStdoutOutput,
} from '../test/utils/setup-cli-runner.spec.util';

type ExitCodeSetter = SetupCliDependencies['setExitCode'];

const DECLINED_RESULT: SetupApplyResult = {
  status: 'aborted',
  path: '/tmp/custom.json',
  reason: 'the confirmation prompt was declined, so no files were written',
};

const NEEDS_YES_RESULT: SetupApplyResult = {
  status: 'aborted',
  path: '/tmp/custom.json',
  reason: 'a non-interactive write needs --yes, so no files were written',
};

const buildCustomPlan = (): SetupPlan => createSetupPlan({ targetPath: '/tmp/custom.json' });

describe('runConfiguredSetup abort', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GIVEN an interactive write without yes and a declined prompt', () => {
    it('WHEN running configured setup THEN it sets the aborted exit code', async () => {
      const setExitCode = vi.fn<ExitCodeSetter>();
      const promptConfirm = vi.fn().mockResolvedValue(false);
      const dependencies = createSetupCliDependencies({ setExitCode, promptConfirm, isInteractive: true });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ yes: false }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(setExitCode).toHaveBeenCalledWith(SETUP_ABORTED_EXIT_CODE);
    });

    it('WHEN running configured setup with json output THEN it prints only json with an aborted result', async () => {
      const stdoutWrite = vi.fn<(text: string) => void>();
      const promptConfirm = vi.fn().mockResolvedValue(false);
      const dependencies = createSetupCliDependencies({
        stdoutWrite,
        promptConfirm,
        isInteractive: true,
        buildSetupPlan: buildCustomPlan,
      });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ yes: false, output: 'json' }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      const parsed: unknown = JSON.parse(readStdoutOutput(stdoutWrite));

      expect(parsed).toMatchObject({ client: 'claude-code', targetPath: '/tmp/custom.json', result: DECLINED_RESULT });
    });
  });

  describe('GIVEN a non-interactive write without yes', () => {
    it('WHEN running configured setup THEN it sets the aborted exit code', async () => {
      const setExitCode = vi.fn<ExitCodeSetter>();
      const dependencies = createSetupCliDependencies({ setExitCode, isInteractive: false });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ yes: false }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(setExitCode).toHaveBeenCalledWith(SETUP_ABORTED_EXIT_CODE);
    });

    it('WHEN running configured setup with json output THEN it prints json with an aborted result', async () => {
      const stdoutWrite = vi.fn<(text: string) => void>();
      const dependencies = createSetupCliDependencies({ stdoutWrite, buildSetupPlan: buildCustomPlan });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ yes: false, output: 'json' }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      const parsed: unknown = JSON.parse(readStdoutOutput(stdoutWrite));

      expect(parsed).toMatchObject({ result: NEEDS_YES_RESULT });
    });
  });

  describe('GIVEN a plan that needs no consent', () => {
    it('WHEN running a dry run without yes THEN it leaves the exit code alone', async () => {
      const setExitCode = vi.fn<ExitCodeSetter>();
      const buildSetupPlan = (): SetupPlan => createSetupPlan({ writeIntent: 'skip', dryRun: true });
      const dependencies = createSetupCliDependencies({ setExitCode, buildSetupPlan });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ yes: false, dryRun: true }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(setExitCode).not.toHaveBeenCalled();
    });

    it('WHEN running an unchanged cursor plan without yes THEN it leaves the exit code alone', async () => {
      const setExitCode = vi.fn<ExitCodeSetter>();
      const buildSetupPlan = (): SetupPlan => createSetupPlan({ client: 'cursor', writeIntent: 'unchanged' });
      const dependencies = createSetupCliDependencies({ setExitCode, buildSetupPlan });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ client: 'cursor', yes: false }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(setExitCode).not.toHaveBeenCalled();
    });
  });
});
