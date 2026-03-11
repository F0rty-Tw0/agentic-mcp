import type { AskToolArgs } from '../../ask';
import type { AskAllToolArgs } from '../../ask-all';
import { ValidationError } from '../../shared';

type BuildAskAllToolArgsInput = Readonly<{
  askArgs: AskToolArgs;
  normalizedArgs: readonly string[];
}>;

const ASK_ALL_PROVIDER_FLAGS = new Set(['--provider', '--providers']);
const ASK_ALL_MODEL_FLAGS = new Set(['--model', '--models']);
const ASK_ALL_VALUE_FLAGS = new Set([
  '--config',
  '--context',
  '--model',
  '--providers',
  '--system-prompt',
  '--working-dir',
]);
const ASK_ALL_BOOLEAN_FLAGS = new Set(['--include-structured', '--stream-live']);

const buildUnsupportedAskAllFlagMessage = (flag: string): string =>
  `Unknown flag "${flag}" for ask_all. Use --providers or --model for supported ask_all options.`;

const buildAskAllMultipleModelsMessage = (): string =>
  'ask_all accepts exactly one shared --model value. Use --providers for provider selection or quote the model name.';

const splitCsvValues = (value: string): readonly string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const splitWhitespaceValues = (value: string): readonly string[] =>
  value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const collectTrailingValues = (args: readonly string[], startIndex: number): readonly string[] => {
  const values: string[] = [];

  for (let i = startIndex; i < args.length; i += 1) {
    const value = args[i];

    if (value == null || value.startsWith('--')) break;

    values.push(value);
  }

  return values;
};

const normalizeProviderValues = (values: readonly string[]): string | undefined => {
  const normalizedValues = values.flatMap((value) =>
    splitCsvValues(value).flatMap((entry) => splitWhitespaceValues(entry))
  );

  if (!normalizedValues.length) return;

  return normalizedValues.join(',');
};

const normalizeModelValues = (values: readonly string[]): string | undefined => {
  const normalizedValues = values.map((value) => value.trim()).filter((value) => value.length > 0);

  if (!normalizedValues.length) return;

  if (normalizedValues.length > 1) {
    throw new ValidationError(buildAskAllMultipleModelsMessage());
  }

  return normalizedValues[0];
};

export const normalizeAskAllArgs = (args: readonly string[]): readonly string[] => {
  const normalizedArgs: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg == null) continue;

    if (ASK_ALL_PROVIDER_FLAGS.has(arg) || ASK_ALL_MODEL_FLAGS.has(arg)) {
      const values = collectTrailingValues(args, i + 1);
      const normalizedValue = ASK_ALL_PROVIDER_FLAGS.has(arg)
        ? normalizeProviderValues(values)
        : normalizeModelValues(values);
      const canonicalFlag = ASK_ALL_PROVIDER_FLAGS.has(arg) ? '--providers' : '--model';

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

export const validateAskAllFlags = (args: readonly string[]): void => {
  for (let i = 0; i < args.length; ) {
    const arg = args[i];

    if (!arg?.startsWith('--')) {
      i += 1;
      continue;
    }

    if (ASK_ALL_VALUE_FLAGS.has(arg)) {
      i += 2;
      continue;
    }

    if (ASK_ALL_BOOLEAN_FLAGS.has(arg)) {
      i += 1;
      continue;
    }

    throw new ValidationError(buildUnsupportedAskAllFlagMessage(arg));
  }
};

const extractProviders = (normalizedArgs: readonly string[]): readonly string[] | undefined => {
  for (let i = 0; i < normalizedArgs.length; i += 1) {
    const arg = normalizedArgs[i];

    if (arg !== '--providers') continue;

    const csv = normalizedArgs[i + 1];
    const result = csv ? splitCsvValues(csv) : undefined;

    return result;
  }

  return undefined;
};

export const buildAskAllToolArgs = (buildAskAllToolArgsInput: BuildAskAllToolArgsInput): AskAllToolArgs => {
  const { askArgs, normalizedArgs } = buildAskAllToolArgsInput;
  const providers = extractProviders(normalizedArgs);
  const providersArgs = providers?.length ? { providers } : {};
  const modelArgs = askArgs.model ? { model: askArgs.model } : {};
  const contextArgs = askArgs.context ? { context: askArgs.context } : {};
  const workingDirectoryArgs = askArgs.working_directory ? { working_directory: askArgs.working_directory } : {};
  const systemPromptArgs = askArgs.system_prompt ? { system_prompt: askArgs.system_prompt } : {};
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
