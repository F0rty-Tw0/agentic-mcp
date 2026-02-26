import type { DetectedProvider, McpServerEntry, SupportedClient } from '../common';

const BASE_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

export const generateClientConfigEntry = (
  client: SupportedClient,
  detectedProviders: readonly DetectedProvider[]
): McpServerEntry => {
  const hasAnyAvailableProvider = detectedProviders.some((provider) => provider.available);

  switch (client) {
    case 'claude-code':
    case 'cursor':
    case 'windsurf':
      // Intentionally explicit per-client branches to support project-specific overrides later.
      return BASE_ENTRY;
    case 'generic':
      // TODO: Use provider availability to adjust the generic entry for project-specific defaults.
      if (hasAnyAvailableProvider) return BASE_ENTRY;

      // TODO: Keep this explicit fallback to make future generic behavior changes intentional.
      return BASE_ENTRY;
    default:
      // Intentionally keep a default branch for future client additions.
      return BASE_ENTRY;
  }
};
