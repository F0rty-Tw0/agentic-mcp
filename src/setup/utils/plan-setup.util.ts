import path from 'node:path';

import { buildMergedClientConfig } from './merge-client-config.util';
import { CLIENT_CONFIG_PATHS } from '../common';
import type { McpServerEntry, SetupMergeStatus, SetupPlan, SetupPlanInput } from '../common';

type SetupConfigObject = Readonly<Record<string, unknown>>;

type OverwriteMergeResult = {
  readonly status: SetupMergeStatus;
  readonly mergedConfig: SetupConfigObject;
};

const buildOverwriteConfig = (agenticServerEntry: McpServerEntry): SetupConfigObject => {
  const mcpServers = { 'agentic-mcp': agenticServerEntry };
  const overwriteConfig: SetupConfigObject = { mcpServers };

  return overwriteConfig;
};

const resolveTargetPath = (input: SetupPlanInput): string | undefined => {
  if (input.pathOverride != null) return input.pathOverride;

  const clientPath = CLIENT_CONFIG_PATHS[input.client];

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

export const buildSetupPlan = (input: SetupPlanInput): SetupPlan => {
  const targetPath = resolveTargetPath(input);
  const mergedConfig = buildMergedClientConfig({
    existingConfigText: input.existingConfigText,
    agenticServerEntry: input.agenticServerEntry,
  });
  const isMergeMode = input.mode === 'merge';
  const isInvalidJson = mergedConfig.status === 'invalid-json';
  const isInvalidMerge = isMergeMode && isInvalidJson;
  const isClaudeStateOverwrite = isClaudeCodeStateOverwrite(input);
  const isWriteBlocked = isInvalidMerge || isClaudeStateOverwrite;
  const writeIntent = resolveWriteIntent(input, targetPath, isWriteBlocked);
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
      `Existing config at ${String(targetPath)} is not valid JSON and was left unchanged (${String(mergedConfig.reason)}). Add the agentic-mcp entry by hand.`
    );
  }

  const overwriteConfig: OverwriteMergeResult = {
    status: 'created',
    mergedConfig: buildOverwriteConfig(input.agenticServerEntry),
  };

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
  };

  return result;
};
