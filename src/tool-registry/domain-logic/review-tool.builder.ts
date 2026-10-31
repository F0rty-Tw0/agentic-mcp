import { z } from 'zod';

import { FLAG_MODEL, FLAG_WORKING_DIR } from '../../ask/common';
import type { ReviewScope } from '../../ask/common';
import { getFlag, getReviewCommand } from '../../ask/utils';
import type { ToolDefinition } from '../../shared/mcp-protocol/common';
import type { CommandDef, ProviderConfig } from '../../shared/provider/common';

type ToolInputSchema = Readonly<Record<string, z.ZodType>>;
type MutableToolInputSchema = Record<string, z.ZodType>;

const addIncludeStructuredField = (schema: MutableToolInputSchema): void => {
  const description = 'Opt in to structured metadata on the result object in addition to surfaced text content';

  schema.include_structured = z.boolean().optional().describe(description);
};

const addModelField = (schema: MutableToolInputSchema, commandDef: CommandDef): void => {
  const modelFlag = getFlag(commandDef, FLAG_MODEL);

  if (modelFlag == null) return;

  const description = 'Model to use for this request. If omitted, the provider CLI default is used';

  schema.model = z.string().optional().describe(description);
};

const buildReviewScopes = (reviewCmd: CommandDef): [ReviewScope, ...ReviewScope[]] => {
  const scopes: ReviewScope[] = [];
  const uncommittedFlag = getFlag(reviewCmd, 'uncommitted');
  const commitFlag = getFlag(reviewCmd, 'commit');
  const baseFlag = getFlag(reviewCmd, 'base');

  if (uncommittedFlag != null) scopes.push('uncommitted');

  if (commitFlag != null) scopes.push('commit');

  if (baseFlag != null) scopes.push('range');

  const [firstScope, ...otherScopes] = scopes;

  if (firstScope == null) throw new Error('Review tool requires at least one supported review scope');

  return [firstScope, ...otherScopes];
};

const buildReviewInputSchema = (config: ProviderConfig): ToolInputSchema => {
  const reviewCmd = getReviewCommand(config);
  const scopeValues = buildReviewScopes(reviewCmd);
  const scopeDescription = 'Review scope — choose uncommitted changes, a single commit, or a range from a base ref.';
  const scope = z.enum(scopeValues).describe(scopeDescription);
  const schema: MutableToolInputSchema = {
    scope,
  };
  const commitFlag = getFlag(reviewCmd, 'commit');
  const baseFlag = getFlag(reviewCmd, 'base');
  const workingDirFlag = getFlag(reviewCmd, FLAG_WORKING_DIR);

  if (commitFlag != null) {
    schema.commit = z.string().optional().describe('Commit SHA or ref to review when scope=commit');
  }

  if (baseFlag != null) {
    schema.base = z.string().optional().describe('Base branch or ref to review against when scope=range');
  }

  if (workingDirFlag != null) {
    const description = 'Working directory path — the review command runs against this repository root';

    schema.working_directory = z.string().optional().describe(description);
  }

  addModelField(schema, reviewCmd);
  schema.stream_live = z.boolean().optional().describe('Emit live output chunks through progress notifications');
  addIncludeStructuredField(schema);

  return schema;
};

export const buildReviewToolDefinition = (providerName: string, config: ProviderConfig): ToolDefinition => {
  const annotations = { readOnlyHint: true, openWorldHint: true };
  const definition: ToolDefinition = {
    name: `review_${providerName}`,
    description:
      `Run a repository review with ${providerName}. Returns review text content and opt-in structured metadata ` +
      `for attribution and parsed provider payloads. Runs synchronously; for a big review likely to take more ` +
      `than about a minute, call ask_${providerName} with mode: "async" and a review prompt instead, then poll ` +
      `with action: "status".`,
    inputSchema: buildReviewInputSchema(config),
    annotations,
  };

  return definition;
};
