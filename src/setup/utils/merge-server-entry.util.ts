import { chooseAliasTimeout, chooseTimeout } from './choose-timeout.util';
import { buildKeptTimeoutNote } from './kept-timeout-note.util';
import type { ClientTarget, McpServerEntry, TimeoutValue } from '../common';

type JsonRecord = Readonly<Record<string, unknown>>;

type MergeServerEntryInput = {
  readonly existingEntry: unknown;
  readonly agenticServerEntry: McpServerEntry;
  readonly target: ClientTarget;
  readonly toolTimeoutMs?: number;
};

type MergeServerEntryResult = {
  readonly entry: JsonRecord;
  readonly notes: string[];
  readonly warnings: string[];
};

const isRecord = (value: unknown): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// A remote server entry: url (most clients), httpUrl (Gemini CLI), serverUrl (Windsurf).
const REMOTE_TRANSPORT_KEYS = ['url', 'httpUrl', 'serverUrl'];

export const findRemoteTransportKey = (existingEntry: unknown): string | undefined => {
  if (!isRecord(existingEntry)) return undefined;

  const remoteKey = REMOTE_TRANSPORT_KEYS.find((key) => key in existingEntry);

  return remoteKey;
};

// Adding a command next to a url mixes transports, which Codex rejects ("url is not supported for stdio").
export const buildRemoteTransportReason = (remoteKey: string): string => {
  const reason = `the agentic-mcp entry uses ${remoteKey} (a remote server) and setup writes a local command; it will not mix the two, so remove ${remoteKey} or replace the entry by hand`;

  return reason;
};

const pickPresentKeys = (source: JsonRecord, keys: string[]): JsonRecord => {
  const presentKeys = keys.filter((key) => key in source);
  const presentEntries = presentKeys.map((key): [string, unknown] => [key, source[key]]);
  const picked: JsonRecord = Object.fromEntries(presentEntries);

  return picked;
};

export const mergeAgenticServerEntry = (input: MergeServerEntryInput): MergeServerEntryResult => {
  const { agenticServerEntry, target, toolTimeoutMs } = input;
  const emptyEntry: JsonRecord = {};
  const existingEntry = isRecord(input.existingEntry) ? input.existingEntry : emptyEntry;
  const generatedEntry: JsonRecord = agenticServerEntry;
  const preservedValues = pickPresentKeys(existingEntry, target.preservedKeys);
  const timeoutValues: Record<string, TimeoutValue> = {};
  const notes: string[] = [];
  const warnings: string[] = [];

  const omittedKeys: string[] = [];

  for (const rule of target.timeoutKeys) {
    const { key } = rule;
    const generatedValue = generatedEntry[key];

    if (typeof generatedValue !== 'number') continue;

    const aliasChoice = chooseAliasTimeout({ rule, existingEntry, generatedValue });
    const choice = aliasChoice ?? chooseTimeout({ rule, existingValue: existingEntry[key], generatedValue });

    notes.push(choice.note);

    if (choice.warning != null) warnings.push(choice.warning);

    if (choice.value == null) {
      omittedKeys.push(key);
      continue;
    }

    timeoutValues[key] = choice.value;
  }

  const keptTimeoutNote = buildKeptTimeoutNote({ key: target.keptTimeoutKey, existingEntry, toolTimeoutMs });

  if (keptTimeoutNote != null) notes.push(keptTimeoutNote);

  const mergedEntry: JsonRecord = { ...existingEntry, ...generatedEntry, ...preservedValues, ...timeoutValues };
  const keptEntries = Object.entries(mergedEntry).filter(([key]) => !omittedKeys.includes(key));
  const entry: JsonRecord = Object.fromEntries(keptEntries);
  const result: MergeServerEntryResult = { entry, notes, warnings };

  return result;
};
