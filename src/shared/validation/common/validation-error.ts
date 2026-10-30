import type { McpErrorResponse, McpTextContent } from '../../mcp-protocol/common';

export class ValidationError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);

    this.name = 'ValidationError';
  }

  public toMcpResponse(): McpErrorResponse {
    const content: McpTextContent[] = [{ type: 'text', text: `Validation error: ${this.message}` }];
    const mcpErrorResponse: McpErrorResponse = {
      isError: true,
      content,
    };

    return mcpErrorResponse;
  }
}
