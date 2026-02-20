import { z } from 'zod';

import {
  FLAG_AUTO_MODE,
  FLAG_FILE,
  FLAG_MODEL,
  FLAG_SANDBOX,
  FLAG_WORKING_DIR,
  getAskCommand,
  getFlag,
} from './command-def-utils.ts';
import type { CommandDef, FlagValue, ProviderConfig } from '../common/provider-config.schema.ts';

type ToolAnnotations = Readonly<{
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}>;

type ToolDefinition = Readonly<{
  name: string;
  description: string;
  inputSchema: Readonly<Record<string, z.ZodType>>;
  annotations: ToolAnnotations;
}>;

const isLeveledFlag = (value: FlagValue): value is { flag: string; values: string[] } => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    schema.session_id = z.string().optional().describe('Session ID for conversation continuity');
  }

  if (getFlag(askCmd, FLAG_AUTO_MODE) != null) {
    schema.auto_mode = z.boolean().optional().describe('Enable autonomous mode (skips confirmation prompts)');
  }

  const sandboxFlag = getFlag(askCmd, FLAG_SANDBOX);

  if (sandboxFlag != null) {
    schema.sandbox = isLeveledFlag(sandboxFlag)
      ? z
          .string()
          .optional()
          .describe(`Sandbox level: ${sandboxFlag.values.join(', ')}`)
      : z.boolean().optional().describe('Enable sandbox mode');
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

export const buildPingToolDefinition = (providerName: string): ToolDefinition => {
  const definition: ToolDefinition = {
    name: `ping_${providerName}`,
    description: `Check if the ${providerName} CLI is available and responsive`,
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return definition;
};

export const buildHelpToolDefinition = (providerName: string): ToolDefinition => {
  const definition: ToolDefinition = {
    name: `help_${providerName}`,
    description: `Show help information for the ${providerName} CLI`,
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return definition;
};

export const buildListProvidersDefinition = (): ToolDefinition => {
  const definition: ToolDefinition = {
    name: 'list_providers',
    description: 'List all configured providers and their availability status',
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return definition;
};
