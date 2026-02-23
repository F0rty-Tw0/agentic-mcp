import { validateSessionId } from '../shared/utils/index.ts';

const safeValidateSessionId = (value: string | undefined): string | undefined => {
  if (!value) return undefined;

  try {
    validateSessionId(value);

    return value;
  } catch {
    return undefined;
  }
};

const parseJsonSessionId = (stdout: string): string | undefined => {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const nestedSession = parsed.session as Record<string, unknown> | undefined;
    const candidate =
      (typeof parsed.session_id === 'string' ? parsed.session_id : undefined) ??
      (typeof parsed.conversation_id === 'string' ? parsed.conversation_id : undefined) ??
      (typeof nestedSession?.id === 'string' ? nestedSession.id : undefined);

    return safeValidateSessionId(candidate);
  } catch {
    return undefined;
  }
};

const parseNdjsonSessionId = (stdout: string): string | undefined => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const lastLine = lines[lines.length - 1];

  if (!lastLine) return undefined;

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

  return undefined;
};
