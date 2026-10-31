import { extractParsedText, parseStructuredLine, splitTrimmedLines } from './output-text.util';
import { stripAnsi } from '../../shared';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import type { ParsedProviderOutput, ProviderOutputMetadata } from '../common';

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

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

  const parsedLines = lines.map((line) => parseStructuredLine(line)).filter(isDefined);

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

  const parsedLines = lines.map((line) => parseStructuredLine(line)).filter(isDefined);

  if (!parsedLines.length) {
    const parsedProviderOutput: ParsedProviderOutput = { text: stdout };

    return parsedProviderOutput;
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
