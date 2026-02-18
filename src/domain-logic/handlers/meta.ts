import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type ResolvedProvider = {
  name: string;
  description: string;
  enabled: boolean;
  available: boolean;
  binaryPath: string | null;
};

function providerStatus(p: ResolvedProvider): string {
  if (p.available) return 'available';

  if (p.enabled) return 'not found';

  return 'disabled';
}

export function handleListProviders(providers: ResolvedProvider[]): CallToolResult {
  const lines = providers.map((p) => `- ${p.name}: ${p.description} [${providerStatus(p)}]`);

  return {
    content: [
      {
        type: 'text',
        text: `Configured providers:\n${lines.join('\n')}`,
      },
    ],
  };
}
