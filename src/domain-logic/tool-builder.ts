import { z } from 'zod';

import type { CommandDef, FlagValue, ProviderConfig } from '../common/provider-config.types.ts';

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodType>;
  annotations: ToolAnnotations;
};

// Well-known flag keys in commands.ask.flags
const FLAG_MODEL = 'model';
const FLAG_WORKING_DIR = 'workingDir';
const FLAG_FILE = 'file';
const FLAG_AUTO_MODE = 'autoMode';
const FLAG_SANDBOX = 'sandbox';

function getAskCommand(config: ProviderConfig): CommandDef {
  const cmd = config.commands.ask;

  if (!cmd) {
    throw new Error('Provider config missing required "ask" command');
  }

  return cmd;
}

function getFlag(cmd: CommandDef, key: string): FlagValue | undefined {
  return cmd.flags?.[key];
}

function isLeveledFlag(value: FlagValue): value is { flag: string; values: string[] } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildAskInputSchema(
  config: ProviderConfig,
  askCmd: CommandDef,
): Record<string, z.ZodType> {
  const schema: Record<string, z.ZodType> = {
    prompt: z.string().describe('The prompt to send to the AI agent'),
  };

  if (config.defaultModel && getFlag(askCmd, FLAG_MODEL) != null) {
    schema.model = z.string().optional().describe(`Model to use (default: ${config.defaultModel})`);
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
    schema.auto_mode = z
      .boolean()
      .optional()
      .describe('Enable autonomous mode (skips confirmation prompts)');
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
}

export function buildAskToolDefinition(
  providerName: string,
  config: ProviderConfig,
): ToolDefinition {
  const askCmd = getAskCommand(config);

  return {
    name: `ask_${providerName}`,
    description: `Send a prompt to ${providerName}: ${config.description}`,
    inputSchema: buildAskInputSchema(config, askCmd),
    annotations: { destructiveHint: true, openWorldHint: true },
  };
}

export function buildPingToolDefinition(providerName: string): ToolDefinition {
  return {
    name: `ping_${providerName}`,
    description: `Check if the ${providerName} CLI is available and responsive`,
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };
}

export function buildHelpToolDefinition(providerName: string): ToolDefinition {
  return {
    name: `help_${providerName}`,
    description: `Show help information for the ${providerName} CLI`,
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };
}

export function buildListProvidersDefinition(): ToolDefinition {
  return {
    name: 'list_providers',
    description: 'List all configured providers and their availability status',
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };
}
