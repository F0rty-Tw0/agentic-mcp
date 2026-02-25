import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const extractTextContent = (response: CallToolResult): string => {
  const [firstContent] = response.content;

  if (firstContent?.type !== 'text') return '';

  return firstContent.text;
};
