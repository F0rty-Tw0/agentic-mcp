import { buildMergedClientConfig } from './merge-client-config.util';
import { buildMergedTomlClientConfig } from './merge-toml-client-config.util';
import type { ClientConfigMergeResult, ClientTarget, McpServerEntry } from '../common';

type BuildClientConfigInput = {
  readonly existingConfigText?: string;
  readonly agenticServerEntry: McpServerEntry;
  readonly target: ClientTarget;
};

const buildJsonClientConfig = (input: BuildClientConfigInput): ClientConfigMergeResult => {
  const merged = buildMergedClientConfig(input);
  const configText = `${JSON.stringify(merged.mergedConfig, null, 2)}\n`;
  const result: ClientConfigMergeResult = {
    status: merged.status,
    configText,
    notes: merged.notes,
    rewritten: false,
    reason: merged.reason,
  };

  return result;
};

export const buildClientConfig = (input: BuildClientConfigInput): ClientConfigMergeResult => {
  if (input.target.format === 'toml') return buildMergedTomlClientConfig(input);

  return buildJsonClientConfig(input);
};
