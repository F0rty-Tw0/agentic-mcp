import type { DetectedProvider, ParsedSetupArgs, SetupApplyResult, SetupPlan } from '../common';
import {
  buildConfiguredSummary,
  buildMinimalNextSteps,
  buildMinimalSummary,
  buildProviderBlock,
} from './setup-cli-output-helpers.util';
import type { MinimalSetupOutputInput } from './setup-cli-output-helpers.util';

const buildSection = (title: string, values: readonly string[]): readonly string[] => {
  return [title, ...values.map((value) => `  - ${value}`)];
};

export { formatProviderSummary, formatSkillOutput } from './setup-cli-output-helpers.util';

export const readExistingConfigText = async (
  targetPath: string | undefined,
  readConfigFile: (path: string) => Promise<string>
): Promise<string | undefined> => {
  if (targetPath == null) {
    return undefined;
  }

  try {
    return await readConfigFile(targetPath);
  } catch {
    return undefined;
  }
};

export const formatJsonSetupOutput = (
  args: ParsedSetupArgs,
  plan: SetupPlan,
  result: SetupApplyResult,
  detectedProviders: readonly DetectedProvider[]
): string => {
  const summary = buildConfiguredSummary(args, result, detectedProviders);
  const payload = {
    client: args.client,
    mode: args.mode,
    dryRun: args.dryRun,
    backup: args.backup,
    writeIntent: plan.writeIntent,
    targetPath: plan.targetPath,
    mergeStatusPreview: plan.mergeStatusPreview,
    warnings: plan.warnings,
    providers: detectedProviders,
    result,
    summary,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
};

export const formatHumanSetupOutput = (
  args: ParsedSetupArgs,
  plan: SetupPlan,
  result: SetupApplyResult,
  detectedProviders: readonly DetectedProvider[]
): string => {
  const summary = buildConfiguredSummary(args, result, detectedProviders);
  const lines = [
    'agentic-mcp setup',
    `Client: ${args.client}`,
    `Mode: ${args.mode}`,
    `Backup: ${args.backup}`,
    `Dry-run: ${String(args.dryRun)}`,
    '',
    ...buildSection('What was done:', summary.completedSteps),
    '',
    'Detected providers:',
    buildProviderBlock(detectedProviders),
    '',
    ...buildSection('What remains unproven:', summary.unproven),
    '',
    summary.nextStep.kind === 'ask' ? 'Next command to prove real use:' : 'Next diagnostic step:',
    `  ${summary.nextStep.command}`,
  ];

  if (plan.warnings.length > 0) {
    lines.push('', 'Warnings:', ...plan.warnings.map((warning) => `  - ${warning}`));
  }

  return `${lines.join('\n')}\n`;
};

export const formatJsonMinimalSetupOutput = (input: MinimalSetupOutputInput): string => {
  const nextSteps = buildMinimalNextSteps(input);
  const summary = buildMinimalSummary(input);
  const payload = {
    mode: 'minimal',
    client: input.client,
    providers: input.detectedProviders,
    skillResult: input.skillResult,
    nextSteps,
    summary,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
};

export const formatHumanMinimalSetupOutput = (input: MinimalSetupOutputInput): string => {
  const summary = buildMinimalSummary(input);
  const lines = [
    'agentic-mcp init',
    'Mode: minimal',
    `Suggested client: ${input.client}`,
    '',
    ...buildSection('What was done:', summary.completedSteps),
    '',
    'Detected providers:',
    buildProviderBlock(input.detectedProviders),
    '',
    ...buildSection('What remains unproven:', summary.unproven),
    '',
    'Next step:',
    `  ${summary.nextStep.command}`,
  ];

  if (summary.firstAskCommand != null) {
    lines.push('', 'First real-answer command after setup:', `  ${summary.firstAskCommand}`);
  }

  return `${lines.join('\n')}\n`;
};

export const isNonInteractiveWriteBlocked = (
  args: ParsedSetupArgs,
  plan: SetupPlan,
  isInteractive: boolean
): boolean => {
  return !isInteractive && !args.yes && plan.writeIntent === 'write';
};
