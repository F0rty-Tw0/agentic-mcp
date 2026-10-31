import { isDeepStrictEqual } from 'node:util';

import { buildRemoteTransportReason, findRemoteTransportKey, mergeAgenticServerEntry } from './merge-server-entry.util';
import type { ClientTarget, McpServerEntry } from '../common';

type MergeClientConfigInput = {
  readonly existingConfigText?: string;
  readonly agenticServerEntry: McpServerEntry;
  readonly target: ClientTarget;
  readonly toolTimeoutMs?: number;
};

type MergeResultStatus = 'created' | 'merged' | 'unchanged' | 'invalid-json' | 'unmergeable';

type JsonRecord = Readonly<Record<string, unknown>>;

type MergeClientConfigResult = {
  readonly status: MergeResultStatus;
  readonly mergedConfig: JsonRecord;
  readonly notes: string[];
  readonly reason?: string;
};

type ParsedConfigSuccess = {
  readonly parsedConfig: unknown;
};

type ParsedConfigFailure = {
  readonly reason: string;
};

type ParsedConfigResult = ParsedConfigSuccess | ParsedConfigFailure;

const isRecord = (value: unknown): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseExistingConfig = (existingConfigText: string): ParsedConfigResult => {
  try {
    const parsedConfig: unknown = JSON.parse(existingConfigText);
    const parsedResult: ParsedConfigSuccess = { parsedConfig };

    return parsedResult;
  } catch (error: unknown) {
    const reason = error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON';
    const failureResult: ParsedConfigFailure = { reason };

    return failureResult;
  }
};

// Replacing a non-object root or servers value drops it; adding a command to a remote entry mixes transports.
const findUnmergeableReason = (parsedConfig: unknown, serversKey: string): string | undefined => {
  if (!isRecord(parsedConfig))
    return 'the config file is not a JSON object, and setup will not replace it; fix or remove the file, then run setup again';

  const serversValue = parsedConfig[serversKey];

  if (serversValue === undefined) return undefined;

  if (!isRecord(serversValue))
    return `${serversKey} is not an object, and setup will not replace it; make it an object or remove it, then run setup again`;

  const remoteKey = findRemoteTransportKey(serversValue['agentic-mcp']);

  if (remoteKey == null) return undefined;

  const reason = buildRemoteTransportReason(remoteKey);

  return reason;
};

const createServersConfig = (parsedRoot: JsonRecord, serversKey: string, servers: JsonRecord): JsonRecord => {
  const result: JsonRecord = {
    ...parsedRoot,
    [serversKey]: servers,
  };

  return result;
};

export const buildMergedClientConfig = (input: MergeClientConfigInput): MergeClientConfigResult => {
  const { existingConfigText, agenticServerEntry, target } = input;
  const emptyRoot: JsonRecord = {};
  const createdEntry = mergeAgenticServerEntry({ existingEntry: undefined, agenticServerEntry, target });
  const createdServers = { 'agentic-mcp': createdEntry.entry };
  const createdConfig = createServersConfig(emptyRoot, target.serversKey, createdServers);
  const createdResult: MergeClientConfigResult = {
    status: 'created',
    mergedConfig: createdConfig,
    notes: createdEntry.notes,
  };

  if (existingConfigText == null) return createdResult;

  const trimmedConfigText = existingConfigText.trim();

  if (trimmedConfigText === '') return createdResult;

  const parseResult = parseExistingConfig(existingConfigText);

  if ('reason' in parseResult) {
    const invalidJsonResult: MergeClientConfigResult = {
      status: 'invalid-json',
      mergedConfig: createdConfig,
      notes: [],
      reason: parseResult.reason,
    };

    return invalidJsonResult;
  }

  const unmergeableReason = findUnmergeableReason(parseResult.parsedConfig, target.serversKey);

  if (unmergeableReason != null) {
    const unmergeableResult: MergeClientConfigResult = {
      status: 'unmergeable',
      mergedConfig: createdConfig,
      notes: [],
      reason: unmergeableReason,
    };

    return unmergeableResult;
  }

  const parsedRoot = isRecord(parseResult.parsedConfig) ? parseResult.parsedConfig : emptyRoot;
  const serversValue = parsedRoot[target.serversKey];
  const currentServers = isRecord(serversValue) ? serversValue : emptyRoot;
  const currentAgentic = currentServers['agentic-mcp'];

  const mergedEntry = mergeAgenticServerEntry({ ...input, existingEntry: currentAgentic });
  const mergedServers = { ...currentServers, 'agentic-mcp': mergedEntry.entry };
  const mergedConfig = createServersConfig(parsedRoot, target.serversKey, mergedServers);
  const isUnchanged = isDeepStrictEqual(currentAgentic, mergedEntry.entry);
  const status: MergeResultStatus = isUnchanged ? 'unchanged' : 'merged';
  const mergedResult: MergeClientConfigResult = {
    status,
    mergedConfig,
    notes: mergedEntry.notes,
  };

  return mergedResult;
};
