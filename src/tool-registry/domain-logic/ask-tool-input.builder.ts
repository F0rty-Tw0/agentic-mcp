import { z } from 'zod';

import {
  FLAG_AUTO_MODE,
  FLAG_EFFORT,
  FLAG_FILE,
  FLAG_MAX_BUDGET,
  FLAG_MODEL,
  FLAG_SANDBOX,
  FLAG_SYSTEM_PROMPT,
  FLAG_WORKING_DIR,
  isLeveledFlag,
} from '../../ask/common';
import { getFlag } from '../../ask/utils';
import type { CommandDef, ProviderConfig } from '../../shared';

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

const addLeveledFlags = (schema: MutableToolInputSchema, askCmd: CommandDef): void => {
  const sandboxFlag = getFlag(askCmd, FLAG_SANDBOX);

  if (sandboxFlag != null) {
    schema.sandbox = isLeveledFlag(sandboxFlag)
      ? z
          .string()
          .optional()
          .describe(`Sandbox isolation level — controls file system access. Allowed: ${sandboxFlag.values.join(', ')}`)
      : z.boolean().optional().describe("Enable sandbox mode to restrict the agent's file system access");
  }

  const effortFlag = getFlag(askCmd, FLAG_EFFORT);

  if (effortFlag != null && isLeveledFlag(effortFlag)) {
    schema.effort = z
      .enum(effortFlag.values)
      .optional()
      .describe(
        `Thinking effort level — higher means more thorough but slower responses. Allowed: ${effortFlag.values.join(', ')}`
      );
  }
};

const addAutoModeField = (schema: MutableToolInputSchema, askCmd: CommandDef): void => {
  const flag = getFlag(askCmd, FLAG_AUTO_MODE);

  if (flag == null) return;

  if (isLeveledFlag(flag)) {
    schema.auto_mode = z
      .enum(flag.values)
      .optional()
      .describe(
        `Permission mode — controls what the agent can do without confirmation. Allowed: ${flag.values.join(', ')}`
      );

    return;
  }

  schema.auto_mode = z
    .boolean()
    .optional()
    .describe('Enable autonomous mode — the agent runs without asking for confirmation');
};

const addStreamingAndAsyncFields = (schema: MutableToolInputSchema): void => {
  schema.action = z
    .enum(['run', 'status'])
    .optional()
    .describe('Request action: run a prompt or poll status for a prior async job (default: run)');

  schema.mode = z
    .enum(['sync', 'async'])
    .optional()
    .describe('Execution mode: sync waits for completion; async returns a job_id for polling (default: sync)');

  schema.stream_live = z.boolean().optional().describe('Emit live output chunks through progress notifications');

  addIncludeStructuredField(schema);

  schema.job_id = z.string().optional().describe('Job identifier used with action=status to poll async ask progress');
};

export const buildAskInputSchema = (config: ProviderConfig, askCmd: CommandDef): ToolInputSchema => {
  const schema: MutableToolInputSchema = {
    context: z.string().optional().describe('Optional user-supplied context to prepend before the current prompt'),
    prompt: z
      .string()
      .optional()
      .describe(
        'The prompt or question to send to the AI agent (required for action=run). For independent long asks, prefer subagent-dispatched parallel execution.'
      ),
  };

  addStreamingAndAsyncFields(schema);
  addModelField(schema, askCmd);

  const hasWorkingDir = getFlag(askCmd, FLAG_WORKING_DIR) != null;
  const hasFile = getFlag(askCmd, FLAG_FILE) != null;

  if (hasWorkingDir || hasFile) {
    schema.working_directory = z
      .string()
      .optional()
      .describe('Working directory path — the agent will have access to files in this directory');
  }

  if (hasFile) {
    schema.files = z.array(z.string()).optional().describe('File paths to include as context for the agent');
  }

  if (config.commands.sessions) {
    schema.session_id = z
      .string()
      .optional()
      .describe('Reserved for Phase 2 — session continuity support. Not yet functional.');
  }

  addAutoModeField(schema, askCmd);
  addLeveledFlags(schema, askCmd);

  if (getFlag(askCmd, FLAG_MAX_BUDGET) != null) {
    schema.max_budget = z
      .string()
      .optional()
      .describe('Maximum spend in USD for this request (e.g. "1.00"). The agent stops when the budget is exhausted');
  }

  if (getFlag(askCmd, FLAG_SYSTEM_PROMPT) != null) {
    schema.system_prompt = z
      .string()
      .optional()
      .describe('Custom system prompt prepended to the conversation — use to set role, constraints, or output format');
  }

  return schema;
};
