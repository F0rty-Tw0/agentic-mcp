import { CommandExecutionError, ValidationError } from '../common/errors';
import type { McpErrorResponse } from '../common/errors';

export const toMcpError = (error: unknown): McpErrorResponse => {
  const isKnownError = error instanceof ValidationError || error instanceof CommandExecutionError;

  if (isKnownError) return error.toMcpResponse();

  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'An unexpected error occurred.';
  }

  const mcpErrorResponse: McpErrorResponse = {
    isError: true,
    content: [{ type: 'text', text: `Error: ${message}` }],
  };

  return mcpErrorResponse;
};
