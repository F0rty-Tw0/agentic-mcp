import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProvider } from '../../../shared/common/index.ts';

const providerStatus = (provider: ResolvedProvider): string => {
  if (provider.available) return 'available';

  if (provider.enabled) return 'not found';

  return 'disabled';
};

export const handleListProviders = (providers: readonly ResolvedProvider[]): CallToolResult => {
  const lines = providers.map((provider) => {
    const status = providerStatus(provider);

    return `- ${provider.name}: ${provider.description} [${status}]`;
  });

  const callToolResult: CallToolResult = {
    content: [
      {
        type: 'text',
        text: `Configured providers:\n${lines.join('\n')}`,
      },
    ],
  };

  return callToolResult;
};
