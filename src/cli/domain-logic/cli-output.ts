import process from 'node:process';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const buildStructuredContentText = (structuredContent: unknown): string => {
  if (!structuredContent) return '';

  const structuredContentText = JSON.stringify(structuredContent, null, 2);

  return structuredContentText;
};

export const extractResultText = (result: CallToolResult): string => {
  const textParts = result.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text);
  const structuredContentText = buildStructuredContentText(result.structuredContent);
  const outputParts = structuredContentText ? [...textParts, structuredContentText] : textParts;
  const text = outputParts.join('\n');

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
