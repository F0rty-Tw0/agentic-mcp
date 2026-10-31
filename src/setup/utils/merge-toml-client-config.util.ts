import { isDeepStrictEqual } from 'node:util';

import { parse, stringify } from 'smol-toml';

import { mergeAgenticServerEntry } from './merge-server-entry.util';
import type { ClientConfigMergeResult, ClientTarget, McpServerEntry } from '../common';

type MergeTomlClientConfigInput = {
  readonly existingConfigText?: string;
  readonly agenticServerEntry: McpServerEntry;
  readonly target: ClientTarget;
};

type TomlRecord = Readonly<Record<string, unknown>>;

type ParsedTomlSuccess = {
  readonly table: TomlRecord;
};

type ParsedTomlFailure = {
  readonly reason: string;
};

type ParsedTomlResult = ParsedTomlSuccess | ParsedTomlFailure;

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

// smol-toml returns null-prototype tables; plain copies compare equal to the objects setup builds.
const toPlainValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toPlainValue);

  if (!isRecord(value) || value instanceof Date) return value;

  const plainEntries = Object.entries(value).map(([key, item]): [string, unknown] => [key, toPlainValue(item)]);
  const plainRecord: TomlRecord = Object.fromEntries(plainEntries);

  return plainRecord;
};

// Large integers stay BigInt, so a rewrite keeps every digit.
const parseToml = (text: string): TomlRecord => {
  const parsedTable = parse(text, { integersAsBigInt: 'asNeeded' });
  const plainTable = toPlainValue(parsedTable);
  const emptyTable: TomlRecord = {};
  const table = isRecord(plainTable) ? plainTable : emptyTable;

  return table;
};

const tryParseToml = (text: string): ParsedTomlResult => {
  try {
    const parsedResult: ParsedTomlSuccess = { table: parseToml(text) };

    return parsedResult;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid TOML';
    const [firstLine] = message.split('\n');
    const failureResult: ParsedTomlFailure = { reason: `Invalid TOML: ${String(firstLine)}` };

    return failureResult;
  }
};

const parsesTo = (text: string, expectedRoot: TomlRecord): boolean => {
  const parsed = tryParseToml(text);
  const isMatch = 'table' in parsed && isDeepStrictEqual(parsed.table, expectedRoot);

  return isMatch;
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
  readonly rewritten?: boolean;
  readonly reason?: string;
};

const createResult = (resultInput: ResultInput): ClientConfigMergeResult => {
  const { status, configText, notes, reason } = resultInput;
  const rewritten = resultInput.rewritten ?? false;
  const result: ClientConfigMergeResult = { status, configText, notes, rewritten, reason };

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
  const { existingText, expectedRoot, notes } = mergedDocument;
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

  return createResult({ status: 'merged', configText: rewrittenText, notes, rewritten: true });
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
  const isServersTable = isRecord(currentServersValue);

  if (currentServersValue !== undefined && !isServersTable) {
    const reason = `${target.serversKey} is not a table, so setup will not replace it`;

    return createResult({ status: 'unmergeable', configText: existingConfigText, notes: [], reason });
  }

  const currentServers = isServersTable ? currentServersValue : emptyServers;
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
