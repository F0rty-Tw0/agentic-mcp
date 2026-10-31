import { isDeepStrictEqual } from 'node:util';

import { stringify } from 'smol-toml';

import { buildRemoteTransportReason, findRemoteTransportKey, mergeAgenticServerEntry } from './merge-server-entry.util';
import { parsesTo, tryParseToml } from './parse-toml.util';
import type { ClientConfigMergeResult, ClientTarget, McpServerEntry, TomlRecord, TomlRewriteCause } from '../common';

type MergeTomlClientConfigInput = {
  readonly existingConfigText?: string;
  readonly agenticServerEntry: McpServerEntry;
  readonly target: ClientTarget;
};

type MergedTomlDocument = {
  readonly existingText: string;
  readonly expectedRoot: TomlRecord;
  readonly agenticTable: TomlRecord;
  readonly isNewEntry: boolean;
  readonly notes: string[];
};

const REWRITE_UNSAFE_REASON =
  'rewriting it with a TOML serializer would change other values, such as -0.0, so the agentic-mcp table cannot be updated safely';

const isRecord = (value: unknown): value is TomlRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const buildAgenticTable = (serversKey: string, entry: TomlRecord): TomlRecord => {
  const servers = { 'agentic-mcp': entry };
  const table: TomlRecord = { [serversKey]: servers };

  return table;
};

type ResultInput = {
  readonly status: ClientConfigMergeResult['status'];
  readonly configText: string;
  readonly notes: string[];
  readonly rewriteCause?: TomlRewriteCause;
  readonly reason?: string;
};

const createResult = (resultInput: ResultInput): ClientConfigMergeResult => {
  const { status, configText, notes, rewriteCause, reason } = resultInput;
  const rewritten = rewriteCause != null;
  const result: ClientConfigMergeResult = { status, configText, notes, rewritten, rewriteCause, reason };

  return result;
};

// Appending keeps the user's comments and layout; a table header always starts from the root.
const appendAgenticTable = (mergedDocument: MergedTomlDocument): string | undefined => {
  if (!mergedDocument.isNewEntry) return undefined;

  const { existingText, agenticTable, expectedRoot } = mergedDocument;
  const separator = existingText.endsWith('\n') ? '\n' : '\n\n';
  const agenticText = stringify(agenticTable);
  const appendedText = `${existingText}${separator}${agenticText}`;
  const isFaithful = parsesTo(appendedText, expectedRoot);

  if (!isFaithful) return undefined;

  return appendedText;
};

const writeMergedDocument = (mergedDocument: MergedTomlDocument): ClientConfigMergeResult => {
  const { existingText, expectedRoot, notes, isNewEntry } = mergedDocument;
  const appendedText = appendAgenticTable(mergedDocument);

  if (appendedText != null) return createResult({ status: 'merged', configText: appendedText, notes });

  const rewrittenText = stringify(expectedRoot);
  const isFaithful = parsesTo(rewrittenText, expectedRoot);

  if (!isFaithful) {
    return createResult({
      status: 'rewrite-unsafe',
      configText: existingText,
      notes: [],
      reason: REWRITE_UNSAFE_REASON,
    });
  }

  const rewriteCause: TomlRewriteCause = isNewEntry ? 'new-entry' : 'existing-entry';

  return createResult({ status: 'merged', configText: rewrittenText, notes, rewriteCause });
};

// Replacing a non-table servers value drops it; adding a command to a remote entry mixes transports.
const findUnmergeableReason = (serversValue: unknown, serversKey: string): string | undefined => {
  if (serversValue === undefined) return undefined;

  if (!isRecord(serversValue))
    return `${serversKey} is not a table, and setup will not replace it; make it a table or remove it, then run setup again`;

  const remoteKey = findRemoteTransportKey(serversValue['agentic-mcp']);

  if (remoteKey == null) return undefined;

  const reason = buildRemoteTransportReason(remoteKey);

  return reason;
};

export const buildMergedTomlClientConfig = (input: MergeTomlClientConfigInput): ClientConfigMergeResult => {
  const { existingConfigText, agenticServerEntry, target } = input;
  const createdEntry = mergeAgenticServerEntry({ existingEntry: undefined, agenticServerEntry, target });
  const createdTable = buildAgenticTable(target.serversKey, createdEntry.entry);
  const createdText = stringify(createdTable);
  const createdResult = createResult({ status: 'created', configText: createdText, notes: createdEntry.notes });
  const trimmedConfigText = existingConfigText?.trim() ?? '';

  if (existingConfigText == null || trimmedConfigText === '') return createdResult;

  const parseResult = tryParseToml(existingConfigText);

  if ('reason' in parseResult) {
    const { reason } = parseResult;

    return createResult({ status: 'invalid-toml', configText: existingConfigText, notes: [], reason });
  }

  const emptyServers: TomlRecord = {};
  const currentServersValue = parseResult.table[target.serversKey];
  const unmergeableReason = findUnmergeableReason(currentServersValue, target.serversKey);

  if (unmergeableReason != null) {
    return createResult({
      status: 'unmergeable',
      configText: existingConfigText,
      notes: [],
      reason: unmergeableReason,
    });
  }

  const currentServers = isRecord(currentServersValue) ? currentServersValue : emptyServers;
  const currentAgentic = currentServers['agentic-mcp'];

  const mergedEntry = mergeAgenticServerEntry({ existingEntry: currentAgentic, agenticServerEntry, target });
  const isUnchanged = isDeepStrictEqual(currentAgentic, mergedEntry.entry);

  if (isUnchanged)
    return createResult({ status: 'unchanged', configText: existingConfigText, notes: mergedEntry.notes });

  const mergedServers = { ...currentServers, 'agentic-mcp': mergedEntry.entry };
  const expectedRoot: TomlRecord = { ...parseResult.table, [target.serversKey]: mergedServers };
  const mergedDocument: MergedTomlDocument = {
    existingText: existingConfigText,
    expectedRoot,
    agenticTable: buildAgenticTable(target.serversKey, mergedEntry.entry),
    isNewEntry: currentAgentic === undefined,
    notes: mergedEntry.notes,
  };

  return writeMergedDocument(mergedDocument);
};
