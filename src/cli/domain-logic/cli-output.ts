import process from 'node:process';

import type { CallToolResult } from '@modelcontextprotocol/server';

type PrintResultOptions = {
  readonly includeStructuredContent?: boolean;
};

type ResultContentPart = CallToolResult['content'][number];

type TextPartShape = {
  readonly type: 'text';
};

type TextContentPart = Extract<ResultContentPart, TextPartShape>;

const isTextPart = (part: ResultContentPart): part is TextContentPart => {
  const result = part.type === 'text';

  return result;
};

const buildStructuredContentText = (structuredContent: unknown, includeStructuredContent: boolean): string => {
  if (!structuredContent || !includeStructuredContent) return '';

  const structuredContentText = JSON.stringify(structuredContent, null, 2);

  return structuredContentText;
};

export const extractResultText = (result: CallToolResult, printResultOptions: PrintResultOptions = {}): string => {
  const { includeStructuredContent = true } = printResultOptions;
  const textContentParts = result.content.filter(isTextPart);
  const textParts = textContentParts.map((part) => part.text);
  const structuredContentText = buildStructuredContentText(result.structuredContent, includeStructuredContent);
  const textWithStructuredParts = [...textParts, structuredContentText];
  const outputParts = structuredContentText ? textWithStructuredParts : textParts;
  const text = outputParts.join('\n');

  return text;
};

export const printResult = (result: CallToolResult, printResultOptions: PrintResultOptions = {}): void => {
  const text = extractResultText(result, printResultOptions);

  if (result.isError) {
    process.stderr.write(`${text}\n`);
    process.exitCode = 1;

    return;
  }

  process.stdout.write(`${text}\n`);
};
