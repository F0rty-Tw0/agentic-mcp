import type { CallToolResult } from '@modelcontextprotocol/server';

export const readFirstText = (result: CallToolResult): string => {
  const [firstContent] = result.content;

  if (firstContent?.type !== 'text') return '';

  return firstContent.text;
};
