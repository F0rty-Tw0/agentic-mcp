import type { OutputFormat } from '../../shared';
import { stripAnsi } from '../../shared';

type ParsedMetadata = Readonly<{
  outputFormatObserved: OutputFormat;
  parsed?: unknown;
}>;

export type ParsedProviderOutput = Readonly<{
  text: string;
  metadata?: ParsedMetadata;
}>;

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

const parseJsonFromMixedOutput = (stdout: string): ParsedProviderOutput | undefined => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length);

  if (!lines.length) return;

  const parsedLines = lines.map((line) => parseJsonLine(line)).filter(isDefined);

  if (!parsedLines.length) return;

  const agentMessages = parsedLines.map((parsedLine) => extractAgentMessageText(parsedLine)).filter(isDefined);
  const latestMessage = agentMessages.at(-1);

  if (latestMessage != null) {
    const parsedProviderOutput: ParsedProviderOutput = {
      text: latestMessage,
      metadata: {
        outputFormatObserved: 'json',
        parsed: parsedLines,
      },
    };

    return parsedProviderOutput;
  }

  const parsedProviderOutput: ParsedProviderOutput = {
    text: JSON.stringify(parsedLines, null, 2),
    metadata: {
      outputFormatObserved: 'json',
      parsed: parsedLines,
    },
  };

  return parsedProviderOutput;
};

const parseJson = (stdout: string): ParsedProviderOutput => {
  try {
    const parsed: unknown = JSON.parse(stdout);
    const topLevelResultText = extractTopLevelResultText(parsed);
    const parsedText = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
    const text = topLevelResultText ?? parsedText;
    const parsedProviderOutput: ParsedProviderOutput = {
      text,
      metadata: {
        outputFormatObserved: 'json',
        parsed,
      },
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
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length);

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

  const parsedProviderOutput: ParsedProviderOutput = {
    text: JSON.stringify(parsedLines, null, 2),
    metadata: {
      outputFormatObserved: 'stream-json',
      parsed: parsedLines,
    },
  };

  return parsedProviderOutput;
};

export const parseProviderOutput = (stdout: string, outputFormat: OutputFormat): ParsedProviderOutput => {
  const cleanOutput = stripAnsi(stdout);

  if (outputFormat === 'json') return parseJson(cleanOutput);

  if (outputFormat === 'stream-json') return parseNdjson(cleanOutput);

  const parsedProviderOutput: ParsedProviderOutput = {
    text: cleanOutput,
    metadata: {
      outputFormatObserved: 'text',
    },
  };

  return parsedProviderOutput;
};
