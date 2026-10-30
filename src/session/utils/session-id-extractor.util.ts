import { validateSessionId } from '../../shared';
import type { OutputFormat } from '../../shared/mcp-protocol/common';

type ParsedSession = {
  readonly id?: unknown;
};

type ParsedSessionResponse = {
  readonly session_id?: unknown;
  readonly conversation_id?: unknown;
  readonly thread_id?: unknown;
  readonly sessionID?: unknown;
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

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const parseJsonSessionId = (stdout: string): string | undefined => {
  try {
    const parsedJson: unknown = JSON.parse(stdout);

    if (!isParsedSessionResponse(parsedJson)) return;

    const parsed = parsedJson;
    const sessionId = asString(parsed.session_id);
    const conversationId = asString(parsed.conversation_id);
    const threadId = asString(parsed.thread_id);
    const camelCaseSessionId = asString(parsed.sessionID);
    const sessionIdInSession = asString(parsed.session?.id);
    const candidate = sessionId ?? conversationId ?? threadId ?? camelCaseSessionId ?? sessionIdInSession;

    return safeValidateSessionId(candidate);
  } catch {
    return;
  }
};

// Providers put the id on different event lines (codex: first `thread.started`, claude: every line).
const parseNdjsonSessionId = (stdout: string): string | undefined => {
  const rawLines = stdout.split(/\r?\n/);
  const trimmedLines = rawLines.map((line) => line.trim());
  const lines = trimmedLines.filter((line) => line.length > 0);

  for (const line of lines) {
    const sessionId = parseJsonSessionId(line);

    if (sessionId) return sessionId;
  }

  return;
};

const parseTextSessionId = (stdout: string): string | undefined => {
  const match = /Session:\s*([a-zA-Z0-9._:-]+)/.exec(stdout);

  return safeValidateSessionId(match?.[1]);
};

export const extractNativeSessionId = (
  _providerName: string,
  stdout: string,
  outputFormat: OutputFormat
): string | undefined => {
  if (outputFormat === 'stream-json') return parseNdjsonSessionId(stdout);

  if (outputFormat === 'text') return parseTextSessionId(stdout);

  const parsed = parseJsonSessionId(stdout);

  if (parsed) return parsed;

  return parseNdjsonSessionId(stdout);
};
