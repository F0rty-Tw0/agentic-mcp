export type McpErrorResponse = Readonly<{
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
}>;
