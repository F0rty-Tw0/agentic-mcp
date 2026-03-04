import process from 'node:process';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const extractResultText = (result: CallToolResult): string => {
  const textParts = result.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text);

  const text = textParts.join('\n');

  return text;
};

export const printResult = (result: CallToolResult): void => {
  const text = extractResultText(result);

  if (result.isError) {
    process.stderr.write(`${text}\n`);
    process.exitCode = 1;

    return;
  }

  process.stdout.write(`${text}\n`);
};
