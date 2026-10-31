import path from 'node:path';

import { buildClientConfig } from './build-client-config.util';
import { CLIENT_TARGETS } from '../common';
import type { ClientConfigMergeResult, SetupMergeStatus, SetupPlan, SetupPlanInput } from '../common';

const BLOCKING_MERGE_STATUSES: SetupMergeStatus[] = ['invalid-json', 'invalid-toml', 'rewrite-unsafe', 'unmergeable'];

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
  readonly mergedConfig: ClientConfigMergeResult;
};

const buildInvalidMergeWarning = (targetPath: string | undefined, mergedConfig: ClientConfigMergeResult): string => {
  const reason = String(mergedConfig.reason);
  const target = String(targetPath);

  if (mergedConfig.status === 'invalid-json') {
    return `Existing config at ${target} is not valid JSON and was left unchanged (${reason}). Add the agentic-mcp entry by hand.`;
  }

  return `Existing config at ${target} could not be merged safely and was left unchanged (${reason}). Add the agentic-mcp entry by hand.`;
};

const buildPlanWarnings = (planWarningsInput: PlanWarningsInput): string[] => {
  const { input, targetPath, isClaudeStateOverwrite, isInvalidMerge, mergedConfig } = planWarningsInput;
  const isMergeRewrite = input.mode === 'merge' && mergedConfig.rewritten;
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
    warnings.push(buildInvalidMergeWarning(targetPath, mergedConfig));
  }

  if (isMergeRewrite) {
    warnings.push(
      `Updating the existing agentic-mcp entry rewrites ${String(targetPath)} with a TOML serializer, so its comments and formatting are not kept (the backup has the original unless --backup never).`
    );
  }

  return warnings;
};

export const buildSetupPlan = (input: SetupPlanInput): SetupPlan => {
  const targetPath = resolveTargetPath(input);
  const target = CLIENT_TARGETS[input.client];
  const mergedConfig = buildClientConfig({
    existingConfigText: input.existingConfigText,
    agenticServerEntry: input.agenticServerEntry,
    target,
  });
  const isMergeMode = input.mode === 'merge';
  const isBlockedMerge = BLOCKING_MERGE_STATUSES.includes(mergedConfig.status);
  const isInvalidMerge = isMergeMode && isBlockedMerge;
  const isClaudeStateOverwrite = isClaudeCodeStateOverwrite(input);
  const isWriteBlocked = isInvalidMerge || isClaudeStateOverwrite;
  const writeIntent = resolveWriteIntent(input, targetPath, isWriteBlocked);
  const warnings = buildPlanWarnings({
    input,
    targetPath,
    isClaudeStateOverwrite,
    isInvalidMerge,
    mergedConfig,
  });

  const overwriteConfig = buildClientConfig({
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
    configText: mergeResult.configText,
    warnings,
    notes: mergeResult.notes,
  };

  return result;
};
