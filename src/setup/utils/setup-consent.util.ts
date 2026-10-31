import type { ParsedSetupArgs, SetupPlan } from '../common';
import { hasClientSkill } from './client-skill.util';

// An unchanged plan writes no config, but for a client with a skill it still installs the skill.
export const isConsentRequired = (plan: SetupPlan): boolean => {
  if (plan.writeIntent === 'write') return true;

  const isSkillOnlyInstall = plan.writeIntent === 'unchanged' && hasClientSkill(plan.client);

  return isSkillOnlyInstall;
};

export const isNonInteractiveWriteBlocked = (
  args: ParsedSetupArgs,
  plan: SetupPlan,
  isInteractive: boolean
): boolean => {
  const isBlocked = !isInteractive && !args.yes && isConsentRequired(plan);

  return isBlocked;
};

export const buildConsentPrompt = (plan: SetupPlan): string => {
  const targetPath = plan.targetPath ?? 'the client config';

  if (plan.writeIntent === 'unchanged') {
    return `agentic-mcp is already configured in ${targetPath}. Install the Claude Code skill? [y/N] `;
  }

  const writePrompt = `Write config to ${targetPath}? [y/N] `;

  return writePrompt;
};
