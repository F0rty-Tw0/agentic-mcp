import path from 'node:path';

import { buildMergedClientConfig } from './merge-client-config.util';
import { CLIENT_CONFIG_PATHS } from '../common';
import type { McpServerEntry, SetupMergeStatus, SetupPlan, SetupPlanInput } from '../common';

type SetupConfigObject = Readonly<Record<string, unknown>>;

const buildOverwriteConfig = (agenticServerEntry: McpServerEntry): SetupConfigObject => {
  const overwriteConfig: SetupConfigObject = {
    mcpServers: {
      'agentic-mcp': agenticServerEntry,
    },
  };

  return overwriteConfig;
};

const resolveTargetPath = (input: SetupPlanInput): string | undefined => {
  if (input.pathOverride != null) return input.pathOverride;

  const clientPath = CLIENT_CONFIG_PATHS[input.client];

  if (clientPath == null) return undefined;

  return path.join(input.homeDirectory, clientPath);
};

export const buildSetupPlan = (input: SetupPlanInput): SetupPlan => {
  const targetPath = resolveTargetPath(input);

  let writeIntent: 'skip' | 'manual' | 'write';

  if (input.dryRun) {
    writeIntent = 'skip';
  } else if (targetPath == null) {
    writeIntent = 'manual';
  } else {
    writeIntent = 'write';
  }
  const warnings: string[] = [];

  if (input.client === 'generic' && targetPath == null) {
    warnings.push('No writable path for generic client. Use --path to write directly.');
  }

  if (input.mode === 'overwrite') {
    warnings.push('Overwrite mode replaces existing config content.');
  }
  const mergedConfig = buildMergedClientConfig({
    existingConfigText: input.existingConfigText,
    agenticServerEntry: input.agenticServerEntry,
  });

  const overwriteConfig = {
    status: 'created' as SetupMergeStatus,
    mergedConfig: buildOverwriteConfig(input.agenticServerEntry),
  };

  const mergeResult = input.mode === 'merge' ? mergedConfig : overwriteConfig;

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
