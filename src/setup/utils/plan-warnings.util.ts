import { buildMovedConfigWarnings } from './moved-config-warnings.util';
import { CLIENT_TARGETS } from '../common';
import type { ClientConfigMergeResult, SetupPlanInput } from '../common';

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

  // An unmergeable reason already says what to change by hand.
  if (mergedConfig.status === 'unmergeable') return `Existing config at ${target} was left unchanged: ${reason}.`;

  if (mergedConfig.status === 'invalid-json') {
    return `Existing config at ${target} is not valid JSON and was left unchanged (${reason}). Add the agentic-mcp entry by hand.`;
  }

  return `Existing config at ${target} could not be merged safely and was left unchanged (${reason}). Add the agentic-mcp entry by hand.`;
};

const buildRewriteWarning = (
  targetPath: string | undefined,
  client: SetupPlanInput['client'],
  mergedConfig: ClientConfigMergeResult
): string => {
  const target = String(targetPath);
  const { serversKey } = CLIENT_TARGETS[client];
  const keptNote = 'so its comments and formatting are not kept (the backup has the original unless --backup never).';

  if (mergedConfig.rewriteCause === 'new-entry') {
    return `Adding the agentic-mcp entry rewrites ${target} with a TOML serializer, because a new [${serversKey}.agentic-mcp] table cannot be appended to it (for example, ${serversKey} is an inline table), ${keptNote}`;
  }

  return `Updating the existing agentic-mcp entry rewrites ${target} with a TOML serializer, ${keptNote}`;
};

export const buildPlanWarnings = (planWarningsInput: PlanWarningsInput): string[] => {
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
    warnings.push(buildRewriteWarning(targetPath, input.client, mergedConfig));
  }

  const movedConfigWarnings = buildMovedConfigWarnings(input, targetPath);

  warnings.push(...movedConfigWarnings);

  return warnings;
};
