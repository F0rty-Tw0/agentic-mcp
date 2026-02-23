import type { ToolDefinition } from '../../../shared/common/index.ts';

export const buildPingToolDefinition = (providerName: string): ToolDefinition => {
  const definition: ToolDefinition = {
    name: `ping_${providerName}`,
    description: `Check if ${providerName} is ready to answer`,
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return definition;
};

export const buildHelpToolDefinition = (providerName: string): ToolDefinition => {
  const definition: ToolDefinition = {
    name: `help_${providerName}`,
    description: `See what ${providerName} can do`,
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return definition;
};

export const buildListProvidersDefinition = (): ToolDefinition => {
  const definition: ToolDefinition = {
    name: 'list_providers',
    description: 'See which AI models are available and their status',
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  };

  return definition;
};
