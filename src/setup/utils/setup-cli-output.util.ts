import type { SkillInstallResult } from './install-skill.util';
import type { ParsedSetupArgs } from './setup-cli-args.util';
import type { DetectedProvider, SetupApplyResult, SetupPlan, SupportedClient } from '../common';

type MinimalSetupOutputInput = Readonly<{
  client: SupportedClient;
  detectedProviders: readonly DetectedProvider[];
  skillResult: SkillInstallResult;
}>;

const buildMinimalNextSteps = (client: SupportedClient): readonly string[] => {
  const nextSteps = [`npx agentic-mcp setup --client ${client} --yes`, 'npx agentic-mcp list_providers'] as const;

  return nextSteps;
};

export const formatProviderSummary = (detectedProviders: readonly DetectedProvider[]): string => {
  const lines = detectedProviders.map((provider) => {
    const status = provider.available ? `✓ ${provider.binaryPath}` : '✗ not found';

    return `  ${provider.name}: ${status}`;
  });

  return lines.join('\n');
};

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
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
};

export const formatHumanSetupOutput = (
  args: ParsedSetupArgs,
  plan: SetupPlan,
  result: SetupApplyResult,
  detectedProviders: readonly DetectedProvider[]
): string => {
  const warningSection =
    plan.warnings.length > 0 ? `\nWarnings:\n${plan.warnings.map((warning) => `  - ${warning}`).join('\n')}\n` : '';

  const lines = [
    'agentic-mcp setup',
    `Client: ${args.client}`,
    `Mode: ${args.mode}`,
    `Backup: ${args.backup}`,
    `Dry-run: ${String(args.dryRun)}`,
    '',
    'Detected providers:',
    formatProviderSummary(detectedProviders),
    '',
    'Planned config:',
    plan.configText.trimEnd(),
    warningSection.trimEnd(),
    '',
    `Result: ${result.status}`,
    result.path == null ? '' : `Path: ${result.path}`,
    result.backupPath == null ? '' : `Backup: ${result.backupPath}`,
    result.reason == null ? '' : `Reason: ${result.reason}`,
    '',
  ].filter((line) => line !== '');

  return `${lines.join('\n')}\n`;
};

export const formatSkillOutput = (skillResult: SkillInstallResult): string => {
  switch (skillResult.status) {
    case 'installed':
      return `Skill installed: ${skillResult.skillPath}\n`;
    case 'already-exists':
      return `Skill already up to date: ${skillResult.skillPath}\n`;
    case 'error':
      return `Skill install failed: ${skillResult.reason ?? 'unknown error'}\n`;
    default:
      return '';
  }
};

export const formatJsonMinimalSetupOutput = (input: MinimalSetupOutputInput): string => {
  const nextSteps = buildMinimalNextSteps(input.client);
  const payload = {
    mode: 'minimal',
    client: input.client,
    providers: input.detectedProviders,
    skillResult: input.skillResult,
    nextSteps,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
};

export const formatHumanMinimalSetupOutput = (input: MinimalSetupOutputInput): string => {
  const nextSteps = buildMinimalNextSteps(input.client);
  const lines = [
    'agentic-mcp init',
    'Mode: minimal',
    `Suggested client: ${input.client}`,
    '',
    'Detected providers:',
    formatProviderSummary(input.detectedProviders),
    '',
    formatSkillOutput(input.skillResult).trimEnd(),
    '',
    'Next steps:',
    ...nextSteps.map((nextStep) => `  ${nextStep}`),
    '',
  ];
  const output = lines.join('\n');

  return `${output}\n`;
};

export const isNonInteractiveWriteBlocked = (
  args: ParsedSetupArgs,
  plan: SetupPlan,
  isInteractive: boolean
): boolean => {
  return !isInteractive && !args.yes && plan.writeIntent === 'write';
};
