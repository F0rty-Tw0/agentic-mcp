import type { TimeoutKeyRule, TimeoutValue } from '../common';

type JsonRecord = Readonly<Record<string, unknown>>;

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

const isTimeoutValue = (value: unknown): value is TimeoutValue => {
  return typeof value === 'number' || typeof value === 'bigint';
};

export const chooseTimeout = (input: TimeoutChoiceInput): TimeoutChoice => {
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
export const chooseAliasTimeout = (input: AliasChoiceInput): TimeoutChoice | undefined => {
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
