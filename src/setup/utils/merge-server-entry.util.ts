import type { ClientTarget, McpServerEntry } from '../common';

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

type TimeoutChoice = {
  readonly value: number;
  readonly note: string;
};

type TimeoutChoiceInput = {
  readonly key: string;
  readonly existingValue: unknown;
  readonly generatedValue: number;
};

const isRecord = (value: unknown): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const chooseTimeout = (input: TimeoutChoiceInput): TimeoutChoice => {
  const { key, existingValue, generatedValue } = input;

  if (typeof existingValue !== 'number') {
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
  const timeoutValues: Record<string, number> = {};
  const notes: string[] = [];

  for (const key of target.timeoutKeys) {
    const generatedValue = generatedEntry[key];

    if (typeof generatedValue !== 'number') continue;

    const choice = chooseTimeout({ key, existingValue: existingEntry[key], generatedValue });

    timeoutValues[key] = choice.value;
    notes.push(choice.note);
  }

  const entry: JsonRecord = { ...existingEntry, ...generatedEntry, ...preservedValues, ...timeoutValues };
  const result: MergeServerEntryResult = { entry, notes };

  return result;
};
