export type McpErrorResponse = Readonly<{
  isError: true;
  content: Array<Readonly<{ type: 'text'; text: string }>>;
}>;
