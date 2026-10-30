import { validateSessionId } from '../../shared';
import type { OutputFormat } from '../../shared/mcp-protocol/common';

type ParsedSession = {
  readonly id?: unknown;
};

type ParsedSessionResponse = {
  readonly session_id?: unknown;
  readonly conversation_id?: unknown;
  readonly session?: ParsedSession;
};

const isParsedSessionResponse = (value: unknown): value is ParsedSessionResponse =>
  typeof value === 'object' && value !== null;

const safeValidateSessionId = (value?: string): string | undefined => {
  if (!value) return;

  try {
    validateSessionId(value);

    return value;
  } catch {
    return;
  }
};

const parseJsonSessionId = (stdout: string): string | undefined => {
  try {
    const parsedJson: unknown = JSON.parse(stdout);

    if (!isParsedSessionResponse(parsedJson)) return;

    const parsed = parsedJson;
    const sessionId = typeof parsed.session_id === 'string' ? parsed.session_id : undefined;
    const conversationId = typeof parsed.conversation_id === 'string' ? parsed.conversation_id : undefined;
    const sessionIdInSession = typeof parsed.session?.id === 'string' ? parsed.session.id : undefined;
    const candidate = sessionId ?? conversationId ?? sessionIdInSession;

    return safeValidateSessionId(candidate);
  } catch {
    return;
  }
};

const parseNdjsonSessionId = (stdout: string): string | undefined => {
  const rawLines = stdout.split(/\r?\n/);
  const trimmedLines = rawLines.map((line) => line.trim());
  const lines = trimmedLines.filter((line) => line.length > 0);
  const lastLine = lines.at(-1);

  if (!lastLine) return;

  return parseJsonSessionId(lastLine);
};

const parseTextSessionId = (stdout: string): string | undefined => {
  const match = /Session:\s*([a-zA-Z0-9._:-]+)/.exec(stdout);

  return safeValidateSessionId(match?.[1]);
};

export const extractNativeSessionId = (
  providerName: string,
  stdout: string,
  outputFormat: OutputFormat
): string | undefined => {
  if (outputFormat === 'stream-json') return parseNdjsonSessionId(stdout);

  if (outputFormat === 'text') return parseTextSessionId(stdout);

  const parsed = parseJsonSessionId(stdout);

  if (parsed) return parsed;

  if (providerName === 'codex') return parseNdjsonSessionId(stdout);

  return;
};
