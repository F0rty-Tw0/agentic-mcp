import { stripAnsi } from '../../shared';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import type { ParsedProviderOutput, ProviderOutputMetadata } from '../common';

type JsonRecord = Readonly<Record<string, unknown>>;

const isJsonRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null;

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const parseJsonLine = (line: string): unknown | undefined => {
  try {
    return JSON.parse(line);
  } catch {
    return;
  }
};

const extractAgentMessageText = (value: unknown): string | undefined => {
  if (!isJsonRecord(value)) return;

  const item = value.item;

  if (!isJsonRecord(item)) return;

  if (item.type !== 'agent_message') return;

  return typeof item.text === 'string' ? item.text : undefined;
};

const extractTopLevelResultText = (value: unknown): string | undefined => {
  if (!isJsonRecord(value)) return;

  if (value.type !== 'result') return;

  return typeof value.result === 'string' ? value.result : undefined;
};

const extractTopLevelResponseText = (value: unknown): string | undefined => {
  if (!isJsonRecord(value)) return;

  return typeof value.response === 'string' ? value.response : undefined;
};

const extractTopLevelTextEventText = (value: unknown): string | undefined => {
  if (!isJsonRecord(value)) return;

  if (value.type !== 'text') return;

  const part = value.part;

  if (isJsonRecord(part) && typeof part.text === 'string') return part.text;

  return typeof value.text === 'string' ? value.text : undefined;
};

const extractParsedText = (value: unknown): string | undefined => {
  return (
    extractTopLevelResultText(value) ??
    extractTopLevelResponseText(value) ??
    extractAgentMessageText(value) ??
    extractTopLevelTextEventText(value)
  );
};

const splitTrimmedLines = (stdout: string): string[] => {
  const rawLines = stdout.split(/\r?\n/);
  const trimmedLines = rawLines.map((line) => line.trim());
  const lines = trimmedLines.filter((line) => line.length);

  return lines;
};

const stringifyParsed = (parsed: unknown): string => {
  if (typeof parsed === 'string') return parsed;

  const text = JSON.stringify(parsed, null, 2);

  return text;
};

const extractLatestParsedText = (parsedLines: unknown[]): string | undefined => {
  const parsedTexts = parsedLines.map((parsedLine) => extractParsedText(parsedLine)).filter(isDefined);

  return parsedTexts.at(-1);
};

const parseJsonFromMixedOutput = (stdout: string): ParsedProviderOutput | undefined => {
  const lines = splitTrimmedLines(stdout);

  if (!lines.length) return;

  const parsedLines = lines.map((line) => parseJsonLine(line)).filter(isDefined);

  if (!parsedLines.length) return;

  const latestMessage = extractLatestParsedText(parsedLines);

  if (latestMessage != null) {
    const metadata: ProviderOutputMetadata = {
      outputFormatObserved: 'json',
      parsed: parsedLines,
    };
    const parsedProviderOutput: ParsedProviderOutput = {
      text: latestMessage,
      metadata,
    };

    return parsedProviderOutput;
  }

  const fallbackMetadata: ProviderOutputMetadata = {
    outputFormatObserved: 'json',
    parsed: parsedLines,
  };
  const parsedProviderOutput: ParsedProviderOutput = {
    text: JSON.stringify(parsedLines, null, 2),
    metadata: fallbackMetadata,
  };

  return parsedProviderOutput;
};

const parseJson = (stdout: string): ParsedProviderOutput => {
  try {
    const parsed: unknown = JSON.parse(stdout);
    const extractedText = extractParsedText(parsed);
    const parsedText = stringifyParsed(parsed);
    const text = extractedText ?? parsedText;
    const metadata: ProviderOutputMetadata = {
      outputFormatObserved: 'json',
      parsed,
    };
    const parsedProviderOutput: ParsedProviderOutput = {
      text,
      metadata,
    };

    return parsedProviderOutput;
  } catch {
    const mixedOutput = parseJsonFromMixedOutput(stdout);

    if (mixedOutput) return mixedOutput;

    const parsedProviderOutput: ParsedProviderOutput = { text: stdout };

    return parsedProviderOutput;
  }
};

const parseNdjson = (stdout: string): ParsedProviderOutput => {
  const lines = splitTrimmedLines(stdout);

  if (!lines.length) {
    const parsedProviderOutput: ParsedProviderOutput = { text: '' };

    return parsedProviderOutput;
  }

  const parsedLines: unknown[] = [];

  for (const line of lines) {
    try {
      parsedLines.push(JSON.parse(line));
    } catch {
      const parsedProviderOutput: ParsedProviderOutput = { text: stdout };

      return parsedProviderOutput;
    }
  }

  const parsedText = extractLatestParsedText(parsedLines) ?? JSON.stringify(parsedLines, null, 2);
  const metadata: ProviderOutputMetadata = {
    outputFormatObserved: 'stream-json',
    parsed: parsedLines,
  };
  const parsedProviderOutput: ParsedProviderOutput = {
    text: parsedText,
    metadata,
  };

  return parsedProviderOutput;
};

export const parseProviderOutput = (stdout: string, outputFormat: OutputFormat): ParsedProviderOutput => {
  const cleanOutput = stripAnsi(stdout);

  if (outputFormat === 'json') return parseJson(cleanOutput);

  if (outputFormat === 'stream-json') return parseNdjson(cleanOutput);

  const metadata: ProviderOutputMetadata = {
    outputFormatObserved: 'text',
  };
  const parsedProviderOutput: ParsedProviderOutput = {
    text: cleanOutput,
    metadata,
  };

  return parsedProviderOutput;
};
