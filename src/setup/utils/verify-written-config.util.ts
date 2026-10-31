import { parse } from 'smol-toml';

import type { ClientConfigFormat, ClientTarget, SetupApplyResult } from '../common';

type ConfigRecord = Readonly<Record<string, unknown>>;

type ParsedWrittenConfig = {
  readonly parsed?: unknown;
  readonly reason?: string;
};

const FORMAT_LABELS: Readonly<Record<ClientConfigFormat, string>> = {
  json: 'JSON',
  toml: 'TOML',
};

const isRecord = (value: unknown): value is ConfigRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const createFailedVerificationResult = (reason: string): SetupApplyResult => {
  const result: SetupApplyResult = {
    status: 'verification-failed',
    path: undefined,
    backupPath: undefined,
    reason,
  };

  return result;
};

const parseByFormat = (content: string, format: ClientConfigFormat): unknown => {
  if (format === 'toml') return parse(content);

  const parsed: unknown = JSON.parse(content);

  return parsed;
};

const parseWrittenConfig = (content: string, format: ClientConfigFormat): ParsedWrittenConfig => {
  const label = FORMAT_LABELS[format];

  try {
    const parsedResult: ParsedWrittenConfig = { parsed: parseByFormat(content, format) };

    return parsedResult;
  } catch (error: unknown) {
    const reason =
      error instanceof Error
        ? `Invalid ${label} in written file: ${error.message}`
        : `Invalid ${label} in written file`;
    const failedResult: ParsedWrittenConfig = { reason };

    return failedResult;
  }
};

export const verifyWrittenConfig = (content: string, target: ClientTarget): SetupApplyResult => {
  const { serversKey } = target;
  const { parsed, reason } = parseWrittenConfig(content, target.format);

  if (reason != null) return createFailedVerificationResult(reason);

  if (!isRecord(parsed)) return createFailedVerificationResult('Written config root must be an object.');

  const servers = parsed[serversKey];

  if (!isRecord(servers))
    return createFailedVerificationResult(`Written config must include object key ${serversKey}.`);

  if (servers['agentic-mcp'] == null) {
    return createFailedVerificationResult(`Written config must include ${serversKey}["agentic-mcp"].`);
  }

  const successResult: SetupApplyResult = {
    status: 'written',
    path: undefined,
    backupPath: undefined,
  };

  return successResult;
};
