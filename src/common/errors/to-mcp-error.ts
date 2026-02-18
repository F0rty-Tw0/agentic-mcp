import { CommandExecutionError } from './command-execution.error.js';
import type { McpErrorResponse } from './mcp-error-response.js';
import { ProviderNotFoundError } from './provider-not-found.error.js';
import { ValidationError } from './validation-error.js';

export function toMcpError(error: unknown): McpErrorResponse {
  if (
    error instanceof ValidationError ||
    error instanceof CommandExecutionError ||
    error instanceof ProviderNotFoundError
  ) {
    return error.toMcpResponse();
  }

  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'An unexpected error occurred.';
  }

  return {
    isError: true,
    content: [{ type: 'text', text: `Error: ${message}` }],
  };
}
