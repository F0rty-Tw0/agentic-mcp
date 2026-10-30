import type { McpTextContent } from './mcp-content.type';

export type McpErrorResponse = {
  readonly isError: true;
  readonly content: Array<McpTextContent>;
};
