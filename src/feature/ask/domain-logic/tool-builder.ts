import { z } from 'zod';

import type { CommandDef, ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import type { ToolDefinition } from '../../../shared/common/tool-definition.types.ts';
import {
  FLAG_AUTO_MODE,
  FLAG_EFFORT,
  FLAG_FILE,
  FLAG_MAX_BUDGET,
  FLAG_MODEL,
  FLAG_SANDBOX,
  FLAG_SYSTEM_PROMPT,
  FLAG_WORKING_DIR,
} from '../common/command-def.const.ts';
import { isLeveledFlag } from '../common/tool-args.types.ts';
import { getAskCommand, getFlag } from '../utils/command-def-utils.ts';

const addLeveledFlags = (schema: Record<string, z.ZodType>, askCmd: CommandDef): void => {
  const sandboxFlag = getFlag(askCmd, FLAG_SANDBOX);

  if (sandboxFlag != null) {
    schema.sandbox = isLeveledFlag(sandboxFlag)
      ? z
          .string()
          .optional()
          .describe(`Sandbox level: ${sandboxFlag.values.join(', ')}`)
      : z.boolean().optional().describe('Enable sandbox mode');
  }

  const effortFlag = getFlag(askCmd, FLAG_EFFORT);

  if (effortFlag != null && isLeveledFlag(effortFlag)) {
    schema.effort = z
      .enum(effortFlag.values)
      .optional()
      .describe(`Effort level: ${effortFlag.values.join(', ')}`);
  }
};

const buildAskInputSchema = (config: ProviderConfig, askCmd: CommandDef): Readonly<Record<string, z.ZodType>> => {
  const schema: Record<string, z.ZodType> = {
    prompt: z.string().describe('The prompt to send to the AI agent'),
  };

  if (getFlag(askCmd, FLAG_MODEL) != null) {
    schema.model = z.string().optional().describe('Model to use (if omitted, provider CLI default is used)');
  }

  if (getFlag(askCmd, FLAG_WORKING_DIR) != null) {
    schema.working_directory = z.string().optional().describe('Working directory for the command');
  }

  if (getFlag(askCmd, FLAG_FILE) != null) {
    schema.files = z.array(z.string()).optional().describe('Files to include as context');
  }

  if (config.commands.sessions) {
    schema.session_id = z
      .string()
      .optional()
      .describe('Reserved for Phase 2 — session continuity support. Not yet functional.');
  }

  if (getFlag(askCmd, FLAG_AUTO_MODE) != null) {
    schema.auto_mode = z.boolean().optional().describe('Enable autonomous mode (skips confirmation prompts)');
  }

  addLeveledFlags(schema, askCmd);

  if (getFlag(askCmd, FLAG_MAX_BUDGET) != null) {
    schema.max_budget = z.string().optional().describe('Maximum budget in USD (e.g. "1.00")');
  }

  if (getFlag(askCmd, FLAG_SYSTEM_PROMPT) != null) {
    schema.system_prompt = z.string().optional().describe('System prompt to prepend to the conversation');
  }

  return schema;
};

export const buildAskToolDefinition = (providerName: string, config: ProviderConfig): ToolDefinition => {
  const askCmd = getAskCommand(config);

  const definition: ToolDefinition = {
    name: `ask_${providerName}`,
    description: `Send a prompt to ${providerName}: ${config.description}`,
    inputSchema: buildAskInputSchema(config, askCmd),
    annotations: { destructiveHint: true, openWorldHint: true },
  };

  return definition;
};
