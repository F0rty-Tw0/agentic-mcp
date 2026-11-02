import { SETUP_FAILED_EXIT_CODE, SKILL_DRY_RUN_REASON, SKILL_VERIFICATION_FAILED_REASON } from '../common';
import type {
  ConfiguredSetupOutputInput,
  SetupApplyResult,
  SetupCliFlowInput,
  SetupPlan,
  SkillInstallResult,
  SupportedClient,
} from '../common';
import { buildSkippedSkillResult, hasClientSkill } from './client-skill.util';
import { reportSetupAbort } from './setup-abort.util';
import {
  formatHumanMinimalSetupOutput,
  formatHumanSetupOutput,
  formatJsonMinimalSetupOutput,
  formatJsonSetupOutput,
} from './setup-cli-output.util';
import { buildConsentPrompt, isConsentRequired, isNonInteractiveWriteBlocked } from './setup-consent.util';
import { buildSetupPlanFromArgs } from './setup-plan-from-args.util';

const resolveSuggestedClient = (client: SupportedClient): SupportedClient => {
  if (client === 'generic') return 'claude-code';

  return client;
};

const buildConfiguredOutput = (input: ConfiguredSetupOutputInput): string => {
  if (input.parsedArgs.output === 'json') return formatJsonSetupOutput(input);

  return formatHumanSetupOutput(input);
};

type ClientSkillInput = {
  readonly flowInput: SetupCliFlowInput;
  readonly plan: SetupPlan;
  readonly result: SetupApplyResult;
};

// A manual result with a path is an existing config setup will not merge into; without a path, printing the snippet is the job.
const isSetupFailed = (result: SetupApplyResult): boolean => {
  if (result.status === 'verification-failed') return true;

  const isBlockedWrite = result.status === 'manual' && result.path != null;

  return isBlockedWrite;
};

const installClientSkill = async (clientSkillInput: ClientSkillInput): Promise<SkillInstallResult | undefined> => {
  const { flowInput, plan, result } = clientSkillInput;
  const { parsedArgs, dependencies } = flowInput;
  const hasSkill = hasClientSkill(parsedArgs.client);

  if (!hasSkill) return undefined;

  if (plan.writeIntent === 'skip') return undefined;

  if (result.status === 'verification-failed') {
    return buildSkippedSkillResult(dependencies.homeDirectory, SKILL_VERIFICATION_FAILED_REASON);
  }

  // A plan that needs consent only gets here once --yes or the prompt gave it; any other plan needs --yes.
  const isConsentGated = isConsentRequired(plan);
  const hasConsent = parsedArgs.yes || isConsentGated;

  if (!hasConsent) return buildSkippedSkillResult(dependencies.homeDirectory);

  const skillResult = await dependencies.installSkill({ homeDirectory: dependencies.homeDirectory });

  return skillResult;
};

const installMinimalSkill = async (input: SetupCliFlowInput): Promise<SkillInstallResult> => {
  const { parsedArgs, dependencies } = input;

  if (parsedArgs.dryRun) return buildSkippedSkillResult(dependencies.homeDirectory, SKILL_DRY_RUN_REASON);

  const skillResult = await dependencies.installSkill({ homeDirectory: dependencies.homeDirectory });

  return skillResult;
};

export const runMinimalSetup = async (input: SetupCliFlowInput): Promise<void> => {
  const { parsedArgs, dependencies, detectedProviders } = input;
  const client = resolveSuggestedClient(parsedArgs.client);
  const skillResult = await installMinimalSkill(input);
  const jsonMinimalSetupOutput = formatJsonMinimalSetupOutput({ client, detectedProviders, skillResult });
  const humanMinimalSetupOutput = formatHumanMinimalSetupOutput({ client, detectedProviders, skillResult });
  const output = parsedArgs.output === 'json' ? jsonMinimalSetupOutput : humanMinimalSetupOutput;

  dependencies.stdoutWrite(output);
};

export const runConfiguredSetup = async (input: SetupCliFlowInput): Promise<void> => {
  const { parsedArgs, dependencies, detectedProviders } = input;
  const plan = await buildSetupPlanFromArgs({ parsedArgs, dependencies, detectedProviders });

  const isWriteBlocked = isNonInteractiveWriteBlocked(parsedArgs, plan, dependencies.isInteractive);

  if (isWriteBlocked) {
    reportSetupAbort({ parsedArgs, plan, dependencies, cause: 'needs-yes' });

    return;
  }

  const isConsentNeeded = isConsentRequired(plan);

  if (dependencies.isInteractive && !parsedArgs.yes && isConsentNeeded) {
    const consentPrompt = buildConsentPrompt(plan);
    const confirmed = await dependencies.promptConfirm(consentPrompt);

    if (!confirmed) {
      reportSetupAbort({ parsedArgs, plan, dependencies, cause: 'declined' });

      return;
    }
  }

  const result = await dependencies.applySetupPlan(plan);
  const skillResult = await installClientSkill({ flowInput: input, plan, result });
  const output = buildConfiguredOutput({ parsedArgs, plan, result, detectedProviders, skillResult });

  dependencies.stdoutWrite(output);

  const hasFailed = isSetupFailed(result);

  if (hasFailed) dependencies.setExitCode(SETUP_FAILED_EXIT_CODE);
};
