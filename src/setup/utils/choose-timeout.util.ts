import type { TimeoutKeyRule, TimeoutValue } from '../common';

type JsonRecord = Readonly<Record<string, unknown>>;

type TimeoutChoice = {
  readonly value?: TimeoutValue;
  readonly note: string;
  readonly warning?: string;
};

type TimeoutChoiceInput = {
  readonly rule: TimeoutKeyRule;
  readonly existingValue: unknown;
  readonly generatedValue: number;
};

type KeptChoiceInput = {
  readonly key: string;
  readonly existingValue: TimeoutValue;
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

const buildKeptNonPositiveChoice = (input: KeptChoiceInput): TimeoutChoice => {
  const { key, existingValue, generatedValue } = input;
  const kept = String(existingValue);
  const keptChoice: TimeoutChoice = {
    value: existingValue,
    note: `agentic-mcp ${key}: kept your ${kept} (0 or below; see the warning).`,
    warning: `agentic-mcp ${key}: kept your ${kept}. The client does not document what 0 or a negative value means (it may mean no limit), so setup leaves it; if the client stops long provider runs, set ${key} to at least ${String(generatedValue)}.`,
  };

  return keptChoice;
};

export const chooseTimeout = (input: TimeoutChoiceInput): TimeoutChoice => {
  const { rule, existingValue, generatedValue } = input;
  const { key } = rule;

  if (!isTimeoutValue(existingValue)) {
    const setChoice: TimeoutChoice = {
      value: generatedValue,
      note: `agentic-mcp ${key}: set to ${String(generatedValue)} (was not set).`,
    };

    return setChoice;
  }

  const isKeptNonPositive = rule.keepsNonPositive === true && existingValue <= 0;

  if (isKeptNonPositive) return buildKeptNonPositiveChoice({ key, existingValue, generatedValue });

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
