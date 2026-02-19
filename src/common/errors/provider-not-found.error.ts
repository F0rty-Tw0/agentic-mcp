import type { McpErrorResponse } from './mcp-error-response.type.ts';

export class ProviderNotFoundError extends Error {
  public readonly provider: string;
  public readonly command: string;

  public constructor(provider: string, command: string, options?: { cause?: unknown }) {
    super(`Provider "${provider}" not available: CLI "${command}" not found on PATH.`, options);

    this.name = 'ProviderNotFoundError';
    this.provider = provider;
    this.command = command;
  }

  public toMcpResponse(): McpErrorResponse {
    const mcpErrorResponse: McpErrorResponse = {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Provider "${this.provider}" not available: CLI "${this.command}" not found on PATH. Install it or disable the provider.`,
        },
      ],
    };

    return mcpErrorResponse;
  }
}
