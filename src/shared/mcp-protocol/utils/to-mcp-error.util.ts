import { CommandExecutionError } from '../../command-execution/common/errors';
import { ValidationError } from '../../validation/common';
import type { McpErrorResponse, McpTextContent } from '../common';

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

  const content: McpTextContent[] = [{ type: 'text', text: `Error: ${message}` }];
  const mcpErrorResponse: McpErrorResponse = {
    isError: true,
    content,
  };

  return mcpErrorResponse;
};
