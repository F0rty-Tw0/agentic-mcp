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

const parseJson = (stdout: string): ParsedProviderOutput => {
  try {
    const parsed: unknown = JSON.parse(stdout);

    return {
      text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2),
      metadata: {
        outputFormatObserved: 'json',
        parsed,
      },
    };
  } catch {
    return { text: stdout };
  }
};

const parseNdjson = (stdout: string): ParsedProviderOutput => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) return { text: '' };

  const parsedLines: unknown[] = [];

  for (const line of lines) {
    try {
      parsedLines.push(JSON.parse(line));
    } catch {
      return { text: stdout };
    }
  }

  return {
    text: JSON.stringify(parsedLines, null, 2),
    metadata: {
      outputFormatObserved: 'stream-json',
      parsed: parsedLines,
    },
  };
};

export const parseProviderOutput = (stdout: string, outputFormat: OutputFormat): ParsedProviderOutput => {
  const cleanOutput = stripAnsi(stdout);

  if (outputFormat === 'json') return parseJson(cleanOutput);

  if (outputFormat === 'stream-json') return parseNdjson(cleanOutput);

  return {
    text: cleanOutput,
    metadata: {
      outputFormatObserved: 'text',
    },
  };
};
