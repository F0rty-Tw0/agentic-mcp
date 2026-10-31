import type { ProviderJsonRecord } from '../common';

export const isProviderJsonRecord = (value: unknown): value is ProviderJsonRecord =>
  typeof value === 'object' && value !== null;

export const parseStructuredLine = (line: string): ProviderJsonRecord | undefined => {
  try {
    const parsed: unknown = JSON.parse(line);

    if (!isProviderJsonRecord(parsed)) return;

    return parsed;
  } catch {
    return;
  }
};

const extractAgentMessageText = (value: unknown): string | undefined => {
  if (!isProviderJsonRecord(value)) return;

  const item = value.item;

  if (!isProviderJsonRecord(item)) return;

  if (item.type !== 'agent_message') return;

  return typeof item.text === 'string' ? item.text : undefined;
};

const extractTopLevelResultText = (value: unknown): string | undefined => {
  if (!isProviderJsonRecord(value)) return;

  if (value.type !== 'result') return;

  return typeof value.result === 'string' ? value.result : undefined;
};

const extractTopLevelResponseText = (value: unknown): string | undefined => {
  if (!isProviderJsonRecord(value)) return;

  return typeof value.response === 'string' ? value.response : undefined;
};

const extractNestedResultEventText = (value: unknown): string | undefined => {
  if (!isProviderJsonRecord(value)) return;

  if (value.event !== 'result') return;

  return extractTopLevelResponseText(value.result);
};

const extractTopLevelTextEventText = (value: unknown): string | undefined => {
  if (!isProviderJsonRecord(value)) return;

  if (value.type !== 'text') return;

  const part = value.part;

  if (isProviderJsonRecord(part) && typeof part.text === 'string') return part.text;

  return typeof value.text === 'string' ? value.text : undefined;
};

export const extractTerminalResultText = (value: unknown): string | undefined => {
  return extractTopLevelResultText(value) ?? extractNestedResultEventText(value);
};

export const extractParsedText = (value: unknown): string | undefined => {
  return (
    extractTopLevelResultText(value) ??
    extractTopLevelResponseText(value) ??
    extractNestedResultEventText(value) ??
    extractAgentMessageText(value) ??
    extractTopLevelTextEventText(value)
  );
};

export const splitTrimmedLines = (stdout: string): string[] => {
  const rawLines = stdout.split(/\r?\n/);
  const trimmedLines = rawLines.map((line) => line.trim());
  const lines = trimmedLines.filter((line) => line.length);

  return lines;
};
