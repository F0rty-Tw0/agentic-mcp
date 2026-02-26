import type { McpTextContent } from '../mcp-content.type';

export type McpErrorResponse = Readonly<{
  isError: true;
  content: Array<McpTextContent>;
}>;
