import type { McpErrorResponse } from './mcp-error-response.js';

export class ValidationError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ValidationError';
  }

  public toMcpResponse(): McpErrorResponse {
    return {
      isError: true,
      content: [{ type: 'text', text: `Validation error: ${this.message}` }],
    };
  }
}
