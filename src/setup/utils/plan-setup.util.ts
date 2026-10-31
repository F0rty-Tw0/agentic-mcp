import path from 'node:path';

import { buildMergedClientConfig } from './merge-client-config.util';
import { CLIENT_TARGETS } from '../common';
import type { SetupPlan, SetupPlanInput } from '../common';

const resolveTargetPath = (input: SetupPlanInput): string | undefined => {
  if (input.pathOverride != null) return input.pathOverride;

  const clientPath = CLIENT_TARGETS[input.client].configPath;

  if (clientPath == null) return undefined;

  return path.join(input.homeDirectory, clientPath);
};

type WriteIntent = SetupPlan['writeIntent'];

const resolveWriteIntent = (
  input: SetupPlanInput,
  targetPath: string | undefined,
  isWriteBlocked: boolean
): WriteIntent => {
  if (input.dryRun) return 'skip';

  if (targetPath == null) return 'manual';

  if (isWriteBlocked) return 'manual';

  return 'write';
};

// ~/.claude.json is Claude Code's state file, not only an MCP config, so overwriting it loses the account and projects.
const isClaudeCodeStateOverwrite = (input: SetupPlanInput): boolean => {
  const isOverwrite = input.mode === 'overwrite';
  const isDefaultClaudePath = input.client === 'claude-code' && input.pathOverride == null;
  const hasExistingFile = input.existingConfigText != null;
  const isStateOverwrite = isOverwrite && isDefaultClaudePath && hasExistingFile;

  return isStateOverwrite;
};

type PlanWarningsInput = {
  readonly input: SetupPlanInput;
  readonly targetPath: string | undefined;
  readonly isClaudeStateOverwrite: boolean;
  readonly isInvalidMerge: boolean;
  readonly mergeReason: string | undefined;
};

const buildPlanWarnings = (planWarningsInput: PlanWarningsInput): string[] => {
  const { input, targetPath, isClaudeStateOverwrite, isInvalidMerge, mergeReason } = planWarningsInput;
  const warnings: string[] = [];

  if (input.client === 'generic' && targetPath == null) {
    warnings.push('No writable path for generic client. Use --path to write directly.');
  }

  if (input.mode === 'overwrite') {
    warnings.push('Overwrite mode replaces existing config content.');
  }

  if (isClaudeStateOverwrite) {
    warnings.push(
      `Overwrite would replace Claude Code's whole state file at ${String(targetPath)} (account, projects, other servers); it was left unchanged. Run again and use --mode merge.`
    );
  }

  if (isInvalidMerge) {
    warnings.push(
      `Existing config at ${String(targetPath)} is not valid JSON and was left unchanged (${String(mergeReason)}). Add the agentic-mcp entry by hand.`
    );
  }

  return warnings;
};

export const buildSetupPlan = (input: SetupPlanInput): SetupPlan => {
  const targetPath = resolveTargetPath(input);
  const target = CLIENT_TARGETS[input.client];
  const mergedConfig = buildMergedClientConfig({
    existingConfigText: input.existingConfigText,
    agenticServerEntry: input.agenticServerEntry,
    target,
  });
  const isMergeMode = input.mode === 'merge';
  const isInvalidJson = mergedConfig.status === 'invalid-json';
  const isInvalidMerge = isMergeMode && isInvalidJson;
  const isClaudeStateOverwrite = isClaudeCodeStateOverwrite(input);
  const isWriteBlocked = isInvalidMerge || isClaudeStateOverwrite;
  const writeIntent = resolveWriteIntent(input, targetPath, isWriteBlocked);
  const warnings = buildPlanWarnings({
    input,
    targetPath,
    isClaudeStateOverwrite,
    isInvalidMerge,
    mergeReason: mergedConfig.reason,
  });

  const overwriteConfig = buildMergedClientConfig({
    existingConfigText: undefined,
    agenticServerEntry: input.agenticServerEntry,
    target,
  });
  const mergeResult = isMergeMode ? mergedConfig : overwriteConfig;

  const result: SetupPlan = {
    client: input.client,
    mode: input.mode,
    backup: input.backup,
    dryRun: input.dryRun,
    writeIntent,
    targetPath,
    mergeStatusPreview: mergeResult.status,
    configText: `${JSON.stringify(mergeResult.mergedConfig, null, 2)}\n`,
    warnings,
    notes: mergeResult.notes,
  };

  return result;
};
