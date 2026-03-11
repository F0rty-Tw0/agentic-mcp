import type { OutputFormat } from '../../shared';
import type { StreamNotifier } from '../../streaming';
import type { ProviderLiveOutputAdapter } from '../common';

type CreateProviderLiveOutputAdapterInput = Readonly<{
  providerName: string;
  outputFormat: OutputFormat;
  streamNotifier: StreamNotifier;
}>;

type JsonRecord = Readonly<Record<string, unknown>>;

const isJsonRecord = (value: unknown): value is JsonRecord => {
  const result = typeof value === 'object' && value !== null;

  return result;
};

const parseJsonLine = (line: string): unknown | undefined => {
  try {
    const parsed: unknown = JSON.parse(line);

    return parsed;
  } catch {
    return;
  }
};

const ensureTrailingNewline = (text: string): string => {
  if (text.endsWith('\n')) return text;

  const result = `${text}\n`;

  return result;
};

const emitProgressLine = (streamNotifier: StreamNotifier, line: string): void => {
  const trimmed = line.trim();

  if (trimmed.length === 0) return;

  const output = ensureTrailingNewline(trimmed);

  streamNotifier.onStderrChunk(output);
};

const resolveToolDetail = (input?: JsonRecord): string | undefined => {
  if (!input) return;

  const description = typeof input.description === 'string' ? input.description : undefined;

  if (description) return description;

  const filePath = typeof input.file_path === 'string' ? input.file_path : undefined;

  if (filePath) return filePath;

  const command = typeof input.command === 'string' ? input.command : undefined;

  return command;
};

const buildToolUseLine = (item: JsonRecord): string | undefined => {
  const name = typeof item.name === 'string' ? item.name : undefined;

  if (!name) return;

  const input = isJsonRecord(item.input) ? item.input : undefined;
  const detail = resolveToolDetail(input);
  const result = detail ? `Using ${name}: ${detail}` : `Using ${name}`;

  return result;
};

const resolveAssistantLine = (item: JsonRecord): string | undefined => {
  if (typeof item.type !== 'string') return;

  if (item.type === 'thinking') return 'Thinking...';

  if (item.type === 'text' && typeof item.text === 'string') {
    const text = item.text.trim();
    const result = text.length > 0 ? text : undefined;

    return result;
  }

  if (item.type !== 'tool_use') return;

  return buildToolUseLine(item);
};

const collectAssistantLines = (value: JsonRecord): string[] => {
  if (value.type !== 'assistant') return [];

  const message = isJsonRecord(value.message) ? value.message : undefined;

  if (!message) return [];

  const content = Array.isArray(message.content) ? message.content : [];
  const lines = content
    .filter(isJsonRecord)
    .map((item) => resolveAssistantLine(item))
    .filter((item): item is string => item !== undefined);

  return lines;
};

const emitClaudeProgressLine = (streamNotifier: StreamNotifier, line: string): void => {
  const parsed = parseJsonLine(line);

  if (!isJsonRecord(parsed)) {
    emitProgressLine(streamNotifier, line);

    return;
  }

  const lines = collectAssistantLines(parsed);

  for (const item of lines) {
    emitProgressLine(streamNotifier, item);
  }
};

const createPassthroughAdapter = (streamNotifier: StreamNotifier): ProviderLiveOutputAdapter => {
  const adapter: ProviderLiveOutputAdapter = {
    onStdoutChunk: streamNotifier.onStdoutChunk,
    onStderrChunk: streamNotifier.onStderrChunk,
    flush: () => undefined,
  };

  return adapter;
};

const createClaudeStreamJsonAdapter = (streamNotifier: StreamNotifier): ProviderLiveOutputAdapter => {
  let stdoutBuffer = '';

  const drainBuffer = (): void => {
    const lines = stdoutBuffer.split(/\r?\n/);
    const nextBuffer = lines.pop() ?? '';

    stdoutBuffer = nextBuffer;

    for (const line of lines) {
      emitClaudeProgressLine(streamNotifier, line);
    }
  };

  const adapter: ProviderLiveOutputAdapter = {
    onStdoutChunk: (chunk: string): void => {
      stdoutBuffer += chunk;
      drainBuffer();
    },
    onStderrChunk: streamNotifier.onStderrChunk,
    flush: (): void => {
      const remaining = stdoutBuffer;

      stdoutBuffer = '';

      if (remaining.length > 0) emitClaudeProgressLine(streamNotifier, remaining);
    },
  };

  return adapter;
};

export const createProviderLiveOutputAdapter = (
  createProviderLiveOutputAdapterInput: CreateProviderLiveOutputAdapterInput
): ProviderLiveOutputAdapter => {
  const { outputFormat, providerName, streamNotifier } = createProviderLiveOutputAdapterInput;

  if (providerName === 'claude' && outputFormat === 'stream-json') {
    const adapter = createClaudeStreamJsonAdapter(streamNotifier);

    return adapter;
  }

  const adapter = createPassthroughAdapter(streamNotifier);

  return adapter;
};
