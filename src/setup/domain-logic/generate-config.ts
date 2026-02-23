import type { DetectedProvider, SupportedClient } from '../common/index.ts';

type McpServerEntry = Readonly<{
  command: string;
  args: readonly string[];
}>;

type McpConfig = Readonly<{
  mcpServers: Readonly<Record<string, McpServerEntry>>;
}>;

export const generateClientConfig = (
  client: SupportedClient,
  detectedProviders: readonly DetectedProvider[]
): string => {
  void client;
  void detectedProviders;

  const config: McpConfig = {
    mcpServers: {
      'agentic-mcp': {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      },
    },
  };

  return JSON.stringify(config, null, 2);
};
