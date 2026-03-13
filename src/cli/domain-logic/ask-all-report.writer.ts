import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { AskAllProviderResult, AskAllResult } from '../../ask-all';
import { ValidationError } from '../../shared';

type WriteAskAllReportInput = Readonly<{
  reportPath: string;
  result: CallToolResult;
}>;

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

const isMarkdownReportPath = (reportPath: string): boolean => {
  const fileExtension = path.extname(reportPath).toLowerCase();
  const isMarkdown = MARKDOWN_EXTENSIONS.has(fileExtension);

  return isMarkdown;
};

const buildProviderSection = (providerResult: AskAllProviderResult): readonly string[] => {
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
    lines.push(...buildProviderSection(providerResult));
  }

  if (lines.at(-1) === '') {
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
  if (isMarkdownReportPath(reportPath)) {
    return buildMarkdownReportContent(structuredContent);
  }

  return buildJsonReportContent(structuredContent);
};

const resolveStructuredContent = (result: CallToolResult): AskAllResult => {
  if (result.structuredContent == null) {
    throw new ValidationError('ask_all report export requires structured comparison data');
  }

  const structuredContent = result.structuredContent as AskAllResult;

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
