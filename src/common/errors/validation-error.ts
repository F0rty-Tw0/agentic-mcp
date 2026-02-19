import type { McpErrorResponse } from './mcp-error-response.type.ts';

export class ValidationError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);

    this.name = 'ValidationError';
  }

  public toMcpResponse(): McpErrorResponse {
    const mcpErrorResponse: McpErrorResponse = {
      isError: true,
      content: [{ type: 'text', text: `Validation error: ${this.message}` }],
    };

    return mcpErrorResponse;
  }
}
