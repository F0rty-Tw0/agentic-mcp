import type { AskToolArgs } from '../../ask/common';
import type { AskAllToolArgs } from '../../ask-all/common';
import { ValidationError } from '../../shared';
import {
  ASK_ALL_BOOLEAN_FLAGS,
  ASK_ALL_MODEL_FLAGS,
  ASK_ALL_PROVIDER_FLAGS,
  ASK_ALL_VALUE_FLAGS,
} from '../common/cli.const';

type BuildAskAllToolArgsInput = {
  readonly askArgs: AskToolArgs;
  readonly normalizedArgs: string[];
};

const buildUnsupportedAskAllFlagMessage = (flag: string): string =>
  `Unknown flag "${flag}" for ask_all. Use --providers or --model for supported ask_all options.`;

const buildAskAllMultipleModelsMessage = (): string =>
  'ask_all accepts exactly one shared --model value. Use --providers for provider selection or quote the model name.';

const splitCsvValues = (value: string): string[] => {
  const entries = value.split(',');
  const trimmedEntries = entries.map((entry) => entry.trim());
  const result = trimmedEntries.filter((entry) => entry.length > 0);

  return result;
};

const splitWhitespaceValues = (value: string): string[] => {
  const entries = value.split(/\s+/);
  const trimmedEntries = entries.map((entry) => entry.trim());
  const result = trimmedEntries.filter((entry) => entry.length > 0);

  return result;
};

const collectTrailingValues = (args: string[], startIndex: number): string[] => {
  const values: string[] = [];

  for (let i = startIndex; i < args.length; i += 1) {
    const value = args[i];
    const isFlag = value?.startsWith('--') ?? false;

    if (value == null || isFlag) break;

    values.push(value);
  }

  return values;
};

const normalizeProviderValues = (values: string[]): string | undefined => {
  const normalizedValues = values.flatMap((value) =>
    splitCsvValues(value).flatMap((entry) => splitWhitespaceValues(entry))
  );

  if (!normalizedValues.length) return;

  return normalizedValues.join(',');
};

const normalizeModelValues = (values: string[]): string | undefined => {
  const normalizedValues = values.map((value) => value.trim()).filter((value) => value.length > 0);

  if (!normalizedValues.length) return;

  if (normalizedValues.length > 1) throw new ValidationError(buildAskAllMultipleModelsMessage());

  return normalizedValues[0];
};

const normalizeFlagValues = (isProviderFlag: boolean, values: string[]): string | undefined => {
  if (isProviderFlag) return normalizeProviderValues(values);

  const result = normalizeModelValues(values);

  return result;
};

export const normalizeAskAllArgs = (args: string[]): string[] => {
  const normalizedArgs: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg == null) continue;

    const isProviderFlag = ASK_ALL_PROVIDER_FLAGS.includes(arg);
    const isModelFlag = ASK_ALL_MODEL_FLAGS.includes(arg);

    if (isProviderFlag || isModelFlag) {
      const values = collectTrailingValues(args, i + 1);
      const normalizedValue = normalizeFlagValues(isProviderFlag, values);
      const canonicalFlag = isProviderFlag ? '--providers' : '--model';

      normalizedArgs.push(canonicalFlag);

      if (normalizedValue) {
        normalizedArgs.push(normalizedValue);
      }

      i += values.length;
      continue;
    }

    normalizedArgs.push(arg);
  }

  return normalizedArgs;
};

export const validateAskAllFlags = (args: string[]): void => {
  for (let i = 0; i < args.length;) {
    const arg = args[i];

    if (!arg?.startsWith('--')) {
      i += 1;
      continue;
    }

    const isValueFlag = ASK_ALL_VALUE_FLAGS.includes(arg);

    if (isValueFlag) {
      i += 2;
      continue;
    }

    const isBooleanFlag = ASK_ALL_BOOLEAN_FLAGS.includes(arg);

    if (isBooleanFlag) {
      i += 1;
      continue;
    }

    throw new ValidationError(buildUnsupportedAskAllFlagMessage(arg));
  }
};

const extractProviders = (normalizedArgs: string[]): string[] | undefined => {
  for (let i = 0; i < normalizedArgs.length; i += 1) {
    const arg = normalizedArgs[i];

    if (arg !== '--providers') continue;

    const csv = normalizedArgs[i + 1];

    if (!csv) return undefined;

    const result = splitCsvValues(csv);

    return result;
  }

  return undefined;
};

export const buildAskAllToolArgs = (buildAskAllToolArgsInput: BuildAskAllToolArgsInput): AskAllToolArgs => {
  const { askArgs, normalizedArgs } = buildAskAllToolArgsInput;
  const providers = extractProviders(normalizedArgs);
  const emptyArgs = {};
  const providersEntry = { providers };
  const modelEntry = { model: askArgs.model };
  const contextEntry = { context: askArgs.context };
  const workingDirectoryEntry = { working_directory: askArgs.working_directory };
  const systemPromptEntry = { system_prompt: askArgs.system_prompt };
  const providersArgs = providers?.length ? providersEntry : emptyArgs;
  const modelArgs = askArgs.model ? modelEntry : emptyArgs;
  const contextArgs = askArgs.context ? contextEntry : emptyArgs;
  const workingDirectoryArgs = askArgs.working_directory ? workingDirectoryEntry : emptyArgs;
  const systemPromptArgs = askArgs.system_prompt ? systemPromptEntry : emptyArgs;
  const result: AskAllToolArgs = {
    prompt: askArgs.prompt ?? '',
    ...providersArgs,
    ...modelArgs,
    ...contextArgs,
    ...workingDirectoryArgs,
    ...systemPromptArgs,
  };

  return result;
};
