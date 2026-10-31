import type { ConfiguredSetupOutputInput, MinimalSetupOutputInput, ParsedSetupArgs, SetupPlan } from '../common';
import {
  buildConfiguredSummary,
  buildMinimalNextSteps,
  buildMinimalSummary,
  buildProviderBlock,
  formatSkillOutput,
} from './setup-cli-output-helpers.util';

const buildSection = (title: string, values: string[]): string[] => {
  const sectionValues = values.map((value) => `  - ${value}`);
  const section = [title, ...sectionValues];

  return section;
};

export { formatProviderSummary, formatSkillOutput } from './setup-cli-output-helpers.util';

const isMissingFileError = (error: unknown): boolean => {
  const hasCode = typeof error === 'object' && error !== null && 'code' in error;
  const isMissingFile = hasCode && error.code === 'ENOENT';

  return isMissingFile;
};

export const readExistingConfigText = async (
  targetPath: string | undefined,
  readConfigFile: (path: string) => Promise<string>
): Promise<string | undefined> => {
  if (targetPath == null) return undefined;

  try {
    return await readConfigFile(targetPath);
  } catch (error) {
    const isMissingFile = isMissingFileError(error);

    if (isMissingFile) return undefined;

    throw error;
  }
};

export const formatJsonSetupOutput = (input: ConfiguredSetupOutputInput): string => {
  const { parsedArgs: args, plan, result, detectedProviders, skillResult } = input;
  const summary = buildConfiguredSummary(args, result, detectedProviders);
  const payload = {
    client: args.client,
    mode: args.mode,
    dryRun: args.dryRun,
    backup: args.backup,
    writeIntent: plan.writeIntent,
    targetPath: plan.targetPath,
    mergeStatusPreview: plan.mergeStatusPreview,
    notes: plan.notes,
    warnings: plan.warnings,
    providers: detectedProviders,
    result,
    skillResult,
    summary,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
};

export const formatHumanSetupOutput = (input: ConfiguredSetupOutputInput): string => {
  const { parsedArgs: args, plan, result, detectedProviders, skillResult } = input;
  const summary = buildConfiguredSummary(args, result, detectedProviders);
  const completedSection = buildSection('What was done:', summary.completedSteps);
  const unprovenSection = buildSection('What remains unproven:', summary.unproven);
  const lines = [
    'agentic-mcp setup',
    `Client: ${args.client}`,
    `Mode: ${args.mode}`,
    `Backup: ${args.backup}`,
    `Dry-run: ${String(args.dryRun)}`,
    '',
    ...completedSection,
    '',
    'Detected providers:',
    buildProviderBlock(detectedProviders),
    '',
    ...unprovenSection,
    '',
    summary.nextStep.kind === 'prove' ? 'Next command to prove real use:' : 'Next diagnostic step:',
    `  ${summary.nextStep.command}`,
  ];

  if (plan.notes.length > 0) {
    const noteLines = plan.notes.map((note) => `  - ${note}`);

    lines.push('', 'Tool-call timeout:', ...noteLines);
  }

  if (plan.warnings.length > 0) {
    const warningLines = plan.warnings.map((warning) => `  - ${warning}`);

    lines.push('', 'Warnings:', ...warningLines);
  }

  const humanOutput = `${lines.join('\n')}\n`;

  if (skillResult == null) return humanOutput;

  const skillOutput = formatSkillOutput(skillResult);

  return `${humanOutput}${skillOutput}`;
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
  const completedSection = buildSection('What was done:', summary.completedSteps);
  const unprovenSection = buildSection('What remains unproven:', summary.unproven);
  const lines = [
    'agentic-mcp init',
    'Mode: minimal',
    `Suggested client: ${input.client}`,
    '',
    ...completedSection,
    '',
    'Detected providers:',
    buildProviderBlock(input.detectedProviders),
    '',
    ...unprovenSection,
    '',
    'Next step:',
    `  ${summary.nextStep.command}`,
  ];

  if (summary.firstProofCommand != null) {
    lines.push('', 'First real-proof command after setup:', `  ${summary.firstProofCommand}`);
  }

  return `${lines.join('\n')}\n`;
};

// An unchanged plan still installs the Claude Code skill, so it needs the same consent as a write.
export const isConsentRequired = (plan: SetupPlan): boolean => {
  return plan.writeIntent === 'write' || plan.writeIntent === 'unchanged';
};

export const isNonInteractiveWriteBlocked = (
  args: ParsedSetupArgs,
  plan: SetupPlan,
  isInteractive: boolean
): boolean => {
  return !isInteractive && !args.yes && isConsentRequired(plan);
};
