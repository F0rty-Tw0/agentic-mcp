import { z } from 'zod';

import { FLAG_MODEL, FLAG_WORKING_DIR } from '../../ask/common';
import type { ReviewScope } from '../../ask/common';
import { getFlag, getReviewCommand } from '../../ask/utils';
import type { CommandDef, ProviderConfig, ToolDefinition } from '../../shared';

type ToolInputSchema = Readonly<Record<string, z.ZodType>>;
type MutableToolInputSchema = Record<string, z.ZodType>;

const addIncludeStructuredField = (schema: MutableToolInputSchema): void => {
  schema.include_structured = z
    .boolean()
    .optional()
    .describe('Opt in to structured metadata on the result object in addition to surfaced text content');
};

const addModelField = (schema: MutableToolInputSchema, commandDef: CommandDef): void => {
  if (getFlag(commandDef, FLAG_MODEL) == null) return;

  schema.model = z
    .string()
    .optional()
    .describe('Model to use for this request. If omitted, the provider CLI default is used');
};

const buildReviewScopes = (reviewCmd: CommandDef): [ReviewScope, ...ReviewScope[]] => {
  const scopes: ReviewScope[] = [];

  if (getFlag(reviewCmd, 'uncommitted') != null) scopes.push('uncommitted');

  if (getFlag(reviewCmd, 'commit') != null) scopes.push('commit');

  if (getFlag(reviewCmd, 'base') != null) scopes.push('range');

  const [firstScope, ...otherScopes] = scopes;

  if (firstScope == null) {
    throw new Error('Review tool requires at least one supported review scope');
  }

  return [firstScope, ...otherScopes];
};

const buildReviewInputSchema = (config: ProviderConfig): ToolInputSchema => {
  const reviewCmd = getReviewCommand(config);
  const scopeValues = buildReviewScopes(reviewCmd);
  const schema: MutableToolInputSchema = {
    scope: z
      .enum(scopeValues)
      .describe('Review scope — choose uncommitted changes, a single commit, or a range from a base ref.'),
  };

  if (getFlag(reviewCmd, 'commit') != null) {
    schema.commit = z.string().optional().describe('Commit SHA or ref to review when scope=commit');
  }

  if (getFlag(reviewCmd, 'base') != null) {
    schema.base = z.string().optional().describe('Base branch or ref to review against when scope=range');
  }

  if (getFlag(reviewCmd, FLAG_WORKING_DIR) != null) {
    schema.working_directory = z
      .string()
      .optional()
      .describe('Working directory path — the review command runs against this repository root');
  }

  addModelField(schema, reviewCmd);
  schema.stream_live = z.boolean().optional().describe('Emit live output chunks through progress notifications');
  addIncludeStructuredField(schema);

  return schema;
};

export const buildReviewToolDefinition = (providerName: string, config: ProviderConfig): ToolDefinition => {
  const definition: ToolDefinition = {
    name: `review_${providerName}`,
    description:
      `Run a repository review with ${providerName}. Returns review text content and opt-in structured metadata ` +
      `for attribution and parsed provider payloads.`,
    inputSchema: buildReviewInputSchema(config),
    annotations: { readOnlyHint: true, openWorldHint: true },
  };

  return definition;
};
