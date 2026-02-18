export type McpErrorResponse = {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
};
