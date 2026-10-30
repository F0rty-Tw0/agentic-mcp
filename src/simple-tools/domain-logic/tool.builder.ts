import type { ToolDefinition } from '../../shared/mcp-protocol/common';

export const buildPingToolDefinition = (providerName: string): ToolDefinition => {
  const annotations = { readOnlyHint: true, idempotentHint: true };
  const definition: ToolDefinition = {
    name: `ping_${providerName}`,
    description: `Check limited proof for ${providerName} (binary detection or version check)`,
    inputSchema: {},
    annotations,
  };

  return definition;
};

export const buildHelpToolDefinition = (providerName: string): ToolDefinition => {
  const annotations = { readOnlyHint: true, idempotentHint: true };
  const definition: ToolDefinition = {
    name: `help_${providerName}`,
    description: `See what ${providerName} can do`,
    inputSchema: {},
    annotations,
  };

  return definition;
};

export const buildListProvidersDefinition = (): ToolDefinition => {
  const annotations = { readOnlyHint: true, idempotentHint: true };
  const definition: ToolDefinition = {
    name: 'list_providers',
    description: 'See configured providers with detected status and next steps',
    inputSchema: {},
    annotations,
  };

  return definition;
};
