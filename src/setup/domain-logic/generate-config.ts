import type { DetectedProvider, McpServerEntry, SupportedClient } from "../common";

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
      return BASE_ENTRY;
    case 'generic':
      if (hasAnyAvailableProvider) {
        return BASE_ENTRY;
      }

      return BASE_ENTRY;
    default:
      return BASE_ENTRY;
  }
};
