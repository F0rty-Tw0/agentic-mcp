import path from 'node:path';

import { buildClientConfig } from './build-client-config.util';
import { buildPlanWarnings } from './plan-warnings.util';
import { describeClientToolTimeout } from './resolve-client-tool-timeout.util';
import { CLIENT_TARGETS } from '../common';
import type { ClientTarget, SetupMergeStatus, SetupPlan, SetupPlanInput } from '../common';

const BLOCKING_MERGE_STATUSES: SetupMergeStatus[] = ['invalid-json', 'invalid-toml', 'rewrite-unsafe', 'unmergeable'];

const resolveTargetPath = (input: SetupPlanInput): string | undefined => {
  if (input.pathOverride != null) return input.pathOverride;

  const clientPath = CLIENT_TARGETS[input.client].configPath;

  if (clientPath == null) return undefined;

  return path.join(input.homeDirectory, clientPath);
};

type WriteIntent = SetupPlan['writeIntent'];

type WriteIntentInput = {
  readonly input: SetupPlanInput;
  readonly targetPath: string | undefined;
  readonly isWriteBlocked: boolean;
  readonly isUnchanged: boolean;
};

const resolveWriteIntent = (writeIntentInput: WriteIntentInput): WriteIntent => {
  const { input, targetPath, isWriteBlocked, isUnchanged } = writeIntentInput;

  if (input.dryRun) return 'skip';

  if (targetPath == null) return 'manual';

  if (isWriteBlocked) return 'manual';

  if (isUnchanged) return 'unchanged';

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

const buildTargetNotes = (input: SetupPlanInput, target: ClientTarget): string[] => {
  if (target.timeoutNote != null) return [target.timeoutNote];

  if (input.toolTimeout == null || target.timeoutKeys.length === 0) return [];

  const notes = [describeClientToolTimeout(input.toolTimeout)];

  return notes;
};

export const buildSetupPlan = (input: SetupPlanInput): SetupPlan => {
  const targetPath = resolveTargetPath(input);
  const target = CLIENT_TARGETS[input.client];
  const mergedConfig = buildClientConfig({
    existingConfigText: input.existingConfigText,
    agenticServerEntry: input.agenticServerEntry,
    target,
    toolTimeoutMs: input.toolTimeout?.ms,
  });
  const isMergeMode = input.mode === 'merge';
  const isBlockedMerge = BLOCKING_MERGE_STATUSES.includes(mergedConfig.status);
  const isInvalidMerge = isMergeMode && isBlockedMerge;
  const isClaudeStateOverwrite = isClaudeCodeStateOverwrite(input);
  const isWriteBlocked = isInvalidMerge || isClaudeStateOverwrite;
  const isUnchanged = isMergeMode && mergedConfig.status === 'unchanged';
  const writeIntent = resolveWriteIntent({ input, targetPath, isWriteBlocked, isUnchanged });
  const planWarnings = buildPlanWarnings({
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
  const warnings = [...planWarnings, ...mergeResult.warnings];
  const targetNotes = buildTargetNotes(input, target);
  const notes = [...mergeResult.notes, ...targetNotes];

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
    notes,
  };

  return result;
};
