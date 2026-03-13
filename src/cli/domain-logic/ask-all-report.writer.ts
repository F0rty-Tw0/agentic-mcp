import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { ValidationError } from '../../shared';

type WriteAskAllReportInput = Readonly<{
  reportPath: string;
  result: CallToolResult;
}>;

const buildReportContent = (structuredContent: unknown): string => {
  const reportContent = `${JSON.stringify(structuredContent, null, 2)}\n`;

  return reportContent;
};

const resolveStructuredContent = (result: CallToolResult): unknown => {
  if (result.structuredContent == null) {
    throw new ValidationError('ask_all report export requires structured comparison data');
  }

  return result.structuredContent;
};

export const writeAskAllReport = async (writeAskAllReportInput: WriteAskAllReportInput): Promise<void> => {
  const { reportPath, result } = writeAskAllReportInput;
  const structuredContent = resolveStructuredContent(result);
  const reportDirectoryPath = path.dirname(reportPath);
  const reportContent = buildReportContent(structuredContent);

  await mkdir(reportDirectoryPath, { recursive: true });
  await writeFile(reportPath, reportContent, 'utf8');
};
