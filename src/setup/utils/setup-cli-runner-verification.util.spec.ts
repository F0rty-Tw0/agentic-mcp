import { afterEach, describe, expect, it, vi } from 'vitest';

import { runConfiguredSetup } from './setup-cli-runner.util';
import { SETUP_FAILED_EXIT_CODE } from '../common';
import type { SetupApplyResult, SetupCliDependencies, SetupPlan } from '../common';
import { DEFAULT_CLAUDE_PATH, TEST_PROVIDERS } from '../test/common/setup.const';
import {
  createParsedSetupArgs,
  createSetupApplyResult,
  createSetupCliDependencies,
  createSetupPlan,
  readStdoutOutput,
} from '../test/utils/setup-cli-runner.spec.util';

type ExitCodeSetter = SetupCliDependencies['setExitCode'];

const VERIFICATION_FAILED_RESULT: SetupApplyResult = {
  status: 'verification-failed',
  path: DEFAULT_CLAUDE_PATH,
  reason: 'Written config must include object key mcpServers.',
};

const applyVerificationFailed = async (): Promise<SetupApplyResult> => Promise.resolve(VERIFICATION_FAILED_RESULT);

const runManualSetup = async (targetPath: string | undefined): Promise<ExitCodeSetter> => {
  const setExitCode = vi.fn<ExitCodeSetter>();
  const buildSetupPlan = (): SetupPlan => createSetupPlan({ writeIntent: 'manual', targetPath });
  const manualResult = createSetupApplyResult({ status: 'manual', path: targetPath });
  const applySetupPlan = async (): Promise<SetupApplyResult> => Promise.resolve(manualResult);
  const dependencies = createSetupCliDependencies({ setExitCode, buildSetupPlan, applySetupPlan });

  await runConfiguredSetup({
    parsedArgs: createParsedSetupArgs(),
    dependencies,
    detectedProviders: TEST_PROVIDERS,
  });

  return setExitCode;
};

describe('runConfiguredSetup verification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GIVEN a write whose read-back check fails', () => {
    it('WHEN running configured setup THEN it sets the failed exit code', async () => {
      const setExitCode = vi.fn<ExitCodeSetter>();
      const dependencies = createSetupCliDependencies({ setExitCode, applySetupPlan: applyVerificationFailed });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs(),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(setExitCode).toHaveBeenCalledWith(SETUP_FAILED_EXIT_CODE);
    });

    it('WHEN running configured setup with json output THEN it prints json with the verification-failed result', async () => {
      const stdoutWrite = vi.fn<(text: string) => void>();
      const dependencies = createSetupCliDependencies({ stdoutWrite, applySetupPlan: applyVerificationFailed });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ output: 'json' }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      const parsed: unknown = JSON.parse(readStdoutOutput(stdoutWrite));

      expect(parsed).toMatchObject({ result: VERIFICATION_FAILED_RESULT });
    });
  });

  describe('GIVEN a write that verifies', () => {
    it('WHEN running configured setup THEN it leaves the exit code alone', async () => {
      const setExitCode = vi.fn<ExitCodeSetter>();
      const dependencies = createSetupCliDependencies({ setExitCode });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs(),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(setExitCode).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN an existing config that setup will not merge into', () => {
    it('WHEN running configured setup THEN it sets the failed exit code', async () => {
      const setExitCode = await runManualSetup(DEFAULT_CLAUDE_PATH);

      expect(setExitCode).toHaveBeenCalledWith(SETUP_FAILED_EXIT_CODE);
    });
  });

  describe('GIVEN a client with no known config path', () => {
    it('WHEN running configured setup THEN it leaves the exit code alone', async () => {
      const setExitCode = await runManualSetup(undefined);

      expect(setExitCode).not.toHaveBeenCalled();
    });
  });
});
