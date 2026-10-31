import type { ClientTarget, McpServerEntry, TimeoutKeyRule } from '../common';

type JsonRecord = Readonly<Record<string, unknown>>;

type MergeServerEntryInput = {
  readonly existingEntry: unknown;
  readonly agenticServerEntry: McpServerEntry;
  readonly target: ClientTarget;
};

type MergeServerEntryResult = {
  readonly entry: JsonRecord;
  readonly notes: string[];
};

// smol-toml parses an integer beyond 2^53 as a BigInt, which is still a set timeout.
type TimeoutValue = number | bigint;

type TimeoutChoice = {
  readonly value?: TimeoutValue;
  readonly note: string;
};

type TimeoutChoiceInput = {
  readonly key: string;
  readonly existingValue: unknown;
  readonly generatedValue: number;
};

type AliasChoiceInput = {
  readonly rule: TimeoutKeyRule;
  readonly existingEntry: JsonRecord;
  readonly generatedValue: number;
};

const MS_PER_SECOND = 1000;

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

const isTimeoutValue = (value: unknown): value is TimeoutValue => {
  return typeof value === 'number' || typeof value === 'bigint';
};

const chooseTimeout = (input: TimeoutChoiceInput): TimeoutChoice => {
  const { key, existingValue, generatedValue } = input;

  if (!isTimeoutValue(existingValue)) {
    const setChoice: TimeoutChoice = {
      value: generatedValue,
      note: `agentic-mcp ${key}: set to ${String(generatedValue)} (was not set).`,
    };

    return setChoice;
  }

  if (existingValue >= generatedValue) {
    const keptChoice: TimeoutChoice = {
      value: existingValue,
      note: `agentic-mcp ${key}: kept your ${String(existingValue)} (not lower than ${String(generatedValue)}).`,
    };

    return keptChoice;
  }

  const raisedChoice: TimeoutChoice = {
    value: generatedValue,
    note: `agentic-mcp ${key}: raised from ${String(existingValue)} to ${String(generatedValue)}.`,
  };

  return raisedChoice;
};

// A seconds key with an ms alias (Codex startup_timeout_ms): keep the alias when it already allows as long.
const chooseAliasTimeout = (input: AliasChoiceInput): TimeoutChoice | undefined => {
  const { rule, existingEntry, generatedValue } = input;

  if (rule.msAliasKey == null || rule.key in existingEntry) return undefined;

  const aliasValue = existingEntry[rule.msAliasKey];

  if (!isTimeoutValue(aliasValue)) return undefined;

  const aliasLabel = `${rule.msAliasKey} ${String(aliasValue)}`;
  const aliasMs = Number(aliasValue);
  const aliasSeconds = aliasMs / MS_PER_SECOND;

  if (aliasSeconds >= generatedValue) {
    const keptChoice: TimeoutChoice = {
      note: `agentic-mcp ${rule.key}: not set; kept your ${aliasLabel} (not lower than ${String(generatedValue)} s).`,
    };

    return keptChoice;
  }

  const setChoice: TimeoutChoice = {
    value: generatedValue,
    note: `agentic-mcp ${rule.key}: set to ${String(generatedValue)} (your ${aliasLabel} was lower).`,
  };

  return setChoice;
};

const pickPresentKeys = (source: JsonRecord, keys: string[]): JsonRecord => {
  const presentKeys = keys.filter((key) => key in source);
  const presentEntries = presentKeys.map((key): [string, unknown] => [key, source[key]]);
  const picked: JsonRecord = Object.fromEntries(presentEntries);

  return picked;
};

export const mergeAgenticServerEntry = (input: MergeServerEntryInput): MergeServerEntryResult => {
  const { agenticServerEntry, target } = input;
  const emptyEntry: JsonRecord = {};
  const existingEntry = isRecord(input.existingEntry) ? input.existingEntry : emptyEntry;
  const generatedEntry: JsonRecord = agenticServerEntry;
  const preservedValues = pickPresentKeys(existingEntry, target.preservedKeys);
  const timeoutValues: Record<string, TimeoutValue> = {};
  const notes: string[] = [];

  const omittedKeys: string[] = [];

  for (const rule of target.timeoutKeys) {
    const { key } = rule;
    const generatedValue = generatedEntry[key];

    if (typeof generatedValue !== 'number') continue;

    const aliasChoice = chooseAliasTimeout({ rule, existingEntry, generatedValue });
    const choice = aliasChoice ?? chooseTimeout({ key, existingValue: existingEntry[key], generatedValue });

    notes.push(choice.note);

    if (choice.value == null) {
      omittedKeys.push(key);
      continue;
    }

    timeoutValues[key] = choice.value;
  }

  const mergedEntry: JsonRecord = { ...existingEntry, ...generatedEntry, ...preservedValues, ...timeoutValues };
  const keptEntries = Object.entries(mergedEntry).filter(([key]) => !omittedKeys.includes(key));
  const entry: JsonRecord = Object.fromEntries(keptEntries);
  const result: MergeServerEntryResult = { entry, notes };

  return result;
};
