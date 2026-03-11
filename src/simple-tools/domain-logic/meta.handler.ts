import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProvider } from '../../shared';

const providerStatus = (provider: ResolvedProvider): string => {
  if (provider.available) return 'binary detected';

  if (provider.enabled) return 'binary missing';

  return 'disabled';
};

const buildProviderLine = (provider: ResolvedProvider): string => {
  const status = providerStatus(provider);

  return `- ${provider.name}: ${provider.description} [${status}]`;
};

const buildNextStep = (providers: readonly ResolvedProvider[]): string => {
  const detectedProvider = providers.find((provider) => provider.enabled && provider.available);

  if (detectedProvider) {
    return `Next: run ask_${detectedProvider.name} to prove authentication and a real response.`;
  }

  return 'Next: install and authenticate a supported provider CLI, then rerun list_providers.';
};

export const handleListProviders = (providers: readonly ResolvedProvider[]): CallToolResult => {
  const lines = providers.map(buildProviderLine);
  const sections = ['Configured providers:'];

  if (lines.length > 0) {
    sections.push(lines.join('\n'));
  }

  sections.push(buildNextStep(providers));

  const text = sections.join('\n');
  const callToolResult: CallToolResult = {
    content: [{ type: 'text', text }],
  };

  return callToolResult;
};
