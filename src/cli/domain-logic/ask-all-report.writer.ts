import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { AskAllProviderResult, AskAllResult } from '../../ask-all/common';
import { ValidationError } from '../../shared';

type WriteAskAllReportInput = {
  readonly reportPath: string;
  readonly result: CallToolResult;
};

type StructuredContent = Readonly<Record<string, unknown>>;

const MISSING_STRUCTURED_CONTENT_MESSAGE = 'ask_all report export requires structured comparison data';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

const isMarkdownReportPath = (reportPath: string): boolean => {
  const fileExtension = path.extname(reportPath).toLowerCase();
  const isMarkdown = MARKDOWN_EXTENSIONS.has(fileExtension);

  return isMarkdown;
};

const buildProviderSection = (providerResult: AskAllProviderResult): string[] => {
  const lines = [
    `## ${providerResult.provider}`,
    `- Status: ${providerResult.success ? 'success' : 'failed'}`,
    `- Execution time: ${providerResult.executionTimeMs}ms`,
    '',
  ];

  if (providerResult.success && providerResult.response != null) {
    return [...lines, '### Response', '```text', providerResult.response, '```', ''];
  }

  return [...lines, '### Error', '```text', providerResult.error ?? 'Unknown provider error', '```', ''];
};

const buildMarkdownReportContent = (structuredContent: AskAllResult): string => {
  const lines = [
    '# Provider comparison report',
    '',
    `- Prompt: ${structuredContent.prompt}`,
    `- Providers: ${structuredContent.totalProviders}`,
    `- Succeeded: ${structuredContent.succeeded}`,
    `- Failed: ${structuredContent.failed}`,
    `- Total execution time: ${structuredContent.totalExecutionTimeMs}ms`,
    '',
  ];

  for (const providerResult of structuredContent.results) {
    const providerSection = buildProviderSection(providerResult);

    lines.push(...providerSection);
  }

  const lastLine = lines.at(-1);

  if (lastLine === '') {
    lines.pop();
  }

  const reportContent = lines.join('\n');

  return reportContent;
};

const buildJsonReportContent = (structuredContent: AskAllResult): string => {
  const reportContent = `${JSON.stringify(structuredContent, null, 2)}\n`;

  return reportContent;
};

const buildReportContent = (reportPath: string, structuredContent: AskAllResult): string => {
  const isMarkdown = isMarkdownReportPath(reportPath);

  if (isMarkdown) return buildMarkdownReportContent(structuredContent);

  return buildJsonReportContent(structuredContent);
};

const hasAskAllCounters = (value: StructuredContent): boolean => {
  const result =
    typeof value.totalProviders === 'number' &&
    typeof value.succeeded === 'number' &&
    typeof value.failed === 'number' &&
    typeof value.totalExecutionTimeMs === 'number';

  return result;
};

const isAskAllResult = (value: StructuredContent): value is AskAllResult => {
  const hasCounters = hasAskAllCounters(value);
  const result = typeof value.prompt === 'string' && Array.isArray(value.results) && hasCounters;

  return result;
};

const resolveStructuredContent = (result: CallToolResult): AskAllResult => {
  const { structuredContent } = result;

  if (structuredContent == null) throw new ValidationError(MISSING_STRUCTURED_CONTENT_MESSAGE);

  if (!isAskAllResult(structuredContent)) throw new ValidationError(MISSING_STRUCTURED_CONTENT_MESSAGE);

  return structuredContent;
};

export const writeAskAllReport = async (writeAskAllReportInput: WriteAskAllReportInput): Promise<void> => {
  const { reportPath, result } = writeAskAllReportInput;
  const structuredContent = resolveStructuredContent(result);
  const reportDirectoryPath = path.dirname(reportPath);
  const reportContent = buildReportContent(reportPath, structuredContent);

  await mkdir(reportDirectoryPath, { recursive: true });
  await writeFile(reportPath, reportContent, 'utf8');
};
