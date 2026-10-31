import type { CallToolResult } from '@modelcontextprotocol/server';

export const extractTextContent = (response: CallToolResult): string => {
  const [firstContent] = response.content;

  if (firstContent?.type !== 'text') return '';

  return firstContent.text;
};
