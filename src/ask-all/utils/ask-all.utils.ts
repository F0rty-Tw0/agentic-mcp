import type { CallToolResult } from '@modelcontextprotocol/sdk/spec.types.js';

export const extractResponseText = (result: CallToolResult): string => {
  const [first] = result.content;

  return first?.type === 'text' ? first.text : '';
};
