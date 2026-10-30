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
} from '../../ask/common';
import { getFlag, isLeveledFlag } from '../../ask/utils';
import type { CommandDef, FlagValue, ProviderConfig } from '../../shared/provider/common';

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

const buildSandboxField = (sandboxFlag: FlagValue): z.ZodType => {
  if (isLeveledFlag(sandboxFlag)) {
    const allowedLevels = sandboxFlag.values.join(', ');
    const leveledDescription = `Sandbox isolation level — controls file system access. Allowed: ${allowedLevels}`;

    return z.string().optional().describe(leveledDescription);
  }

  const description = "Enable sandbox mode to restrict the agent's file system access";

  return z.boolean().optional().describe(description);
};

const addLeveledFlags = (schema: MutableToolInputSchema, askCmd: CommandDef): void => {
  const sandboxFlag = getFlag(askCmd, FLAG_SANDBOX);

  if (sandboxFlag != null) {
    schema.sandbox = buildSandboxField(sandboxFlag);
  }

  const effortFlag = getFlag(askCmd, FLAG_EFFORT);

  if (effortFlag != null && isLeveledFlag(effortFlag)) {
    const allowedEfforts = effortFlag.values.join(', ');
    const description = `Thinking effort level — higher means more thorough but slower responses. Allowed: ${allowedEfforts}`;

    schema.effort = z.enum(effortFlag.values).optional().describe(description);
  }
};

const addAutoModeField = (schema: MutableToolInputSchema, askCmd: CommandDef): void => {
  const flag = getFlag(askCmd, FLAG_AUTO_MODE);

  if (flag == null) return;

  if (isLeveledFlag(flag)) {
    const allowedModes = flag.values.join(', ');
    const leveledDescription = `Permission mode — controls what the agent can do without confirmation. Allowed: ${allowedModes}`;

    schema.auto_mode = z.enum(flag.values).optional().describe(leveledDescription);

    return;
  }

  const description = 'Enable autonomous mode — the agent runs without asking for confirmation';

  schema.auto_mode = z.boolean().optional().describe(description);
};

const addStreamingAndAsyncFields = (schema: MutableToolInputSchema): void => {
  const actionDescription = 'Request action: run a prompt or poll status for a prior async job (default: run)';
  const modeDescription =
    'Execution mode: sync waits for completion; async returns a job_id for polling and does not accept session_id (default: sync)';

  schema.action = z.enum(['run', 'status']).optional().describe(actionDescription);

  schema.mode = z.enum(['sync', 'async']).optional().describe(modeDescription);

  schema.stream_live = z.boolean().optional().describe('Emit live output chunks through progress notifications');

  addIncludeStructuredField(schema);

  schema.job_id = z.string().optional().describe('Job identifier used with action=status to poll async ask progress');
};

const addOptionalStringField = (schema: MutableToolInputSchema, key: string, description: string): void => {
  schema[key] = z.string().optional().describe(description);
};

export const buildAskInputSchema = (config: ProviderConfig, askCmd: CommandDef): ToolInputSchema => {
  const context = z.string().optional().describe('Optional user-supplied context to prepend before the current prompt');
  const promptDescription =
    'The prompt or question to send to the AI agent (required for action=run). For independent long asks, prefer subagent-dispatched parallel execution.';
  const prompt = z.string().optional().describe(promptDescription);
  const schema: MutableToolInputSchema = {
    context,
    prompt,
  };

  addStreamingAndAsyncFields(schema);
  addModelField(schema, askCmd);

  const workingDirFlag = getFlag(askCmd, FLAG_WORKING_DIR);
  const fileFlag = getFlag(askCmd, FLAG_FILE);
  const hasWorkingDir = workingDirFlag != null;
  const hasFile = fileFlag != null;

  if (hasWorkingDir || hasFile) {
    const description = 'Working directory path — the agent will have access to files in this directory';

    addOptionalStringField(schema, 'working_directory', description);
  }

  if (hasFile) {
    schema.files = z.array(z.string()).optional().describe('File paths to include as context for the agent');
  }

  if (config.commands.sessions) {
    const description = 'Reserved for Phase 2 — session continuity support. Not yet functional.';

    addOptionalStringField(schema, 'session_id', description);
  }

  addAutoModeField(schema, askCmd);
  addLeveledFlags(schema, askCmd);

  const maxBudgetFlag = getFlag(askCmd, FLAG_MAX_BUDGET);

  if (maxBudgetFlag != null) {
    const description =
      'Maximum spend in USD for this request (e.g. "1.00"). The agent stops when the budget is exhausted';

    addOptionalStringField(schema, 'max_budget', description);
  }

  const systemPromptFlag = getFlag(askCmd, FLAG_SYSTEM_PROMPT);

  if (systemPromptFlag != null) {
    const description =
      'Custom system prompt prepended to the conversation — use to set role, constraints, or output format';

    addOptionalStringField(schema, 'system_prompt', description);
  }

  return schema;
};
