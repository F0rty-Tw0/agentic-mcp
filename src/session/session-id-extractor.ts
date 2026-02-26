import { validateSessionId } from '../shared/utils';

const safeValidateSessionId = (value?: string): string | undefined => {
  if (!value) return;

  try {
    validateSessionId(value);

    return value;
  } catch {
    return;
  }
};

type ParsedSessionResponse = Readonly<{
  session_id?: unknown;
  conversation_id?: unknown;
  session?: Readonly<{ id?: unknown }>;
}>;

const parseJsonSessionId = (stdout: string): string | undefined => {
  try {
    const parsed = JSON.parse(stdout) as ParsedSessionResponse;
    const candidate =
      (typeof parsed.session_id === 'string' ? parsed.session_id : undefined) ??
      (typeof parsed.conversation_id === 'string' ? parsed.conversation_id : undefined) ??
      (typeof parsed.session?.id === 'string' ? parsed.session.id : undefined);

    return safeValidateSessionId(candidate);
  } catch {
    return;
  }
};

const parseNdjsonSessionId = (stdout: string): string | undefined => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
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
  outputFormat: 'json' | 'stream-json' | 'text'
): string | undefined => {
  if (outputFormat === 'stream-json') return parseNdjsonSessionId(stdout);

  if (outputFormat === 'text') return parseTextSessionId(stdout);

  const parsed = parseJsonSessionId(stdout);

  if (parsed) return parsed;

  if (providerName === 'codex') return parseNdjsonSessionId(stdout);

  return;
};
