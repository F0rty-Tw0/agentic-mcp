import type { CallToolResult } from '@modelcontextprotocol/server';

export const extractResponseText = (result: CallToolResult): string => {
  const [first] = result.content;

  return first?.type === 'text' ? first.text : '';
};
