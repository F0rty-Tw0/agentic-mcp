import type { ToolDefinition } from '../../../shared/common/tool-definition.types.ts';

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
