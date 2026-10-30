import { buildAskAllToolArgs, normalizeAskAllArgs, validateAskAllFlags } from './ask-all-arg-parser.util';
import type { AskToolArgs } from '../../ask/common';
import type { AskAllToolArgs } from '../../ask-all/common';

type AskArgsDraft = { -readonly [TKey in keyof AskToolArgs]: AskToolArgs[TKey] };

type AskArgKey = keyof AskToolArgs;

type ValueFlagKey =
  'model' | 'working_directory' | 'auto_mode' | 'system_prompt' | 'effort' | 'max_budget' | 'context' | 'session_id';

type ParseState = {
  readonly draft: AskArgsDraft;
  readonly files: string[];
};

const VALUE_FLAGS: Readonly<Record<string, ValueFlagKey>> = {
  '--model': 'model',
  '--working-dir': 'working_directory',
  '--auto-mode': 'auto_mode',
  '--system-prompt': 'system_prompt',
  '--effort': 'effort',
  '--max-budget': 'max_budget',
  '--context': 'context',
  '--session-id': 'session_id',
};

const ASK_ARG_KEYS: AskArgKey[] = [
  'prompt',
  'model',
  'working_directory',
  'auto_mode',
  'system_prompt',
  'effort',
  'max_budget',
  'context',
  'session_id',
  'stream_live',
  'include_structured',
  'mode',
  'action',
  'job_id',
];

const parseValueFlag = (state: ParseState, flag: string, value: string | undefined): boolean => {
  const isValueFlag = Object.hasOwn(VALUE_FLAGS, flag);
  const key = isValueFlag ? VALUE_FLAGS[flag] : undefined;

  if (!key) return false;

  state.draft[key] = value;

  return true;
};

const parseSpecialFlags = (state: ParseState, arg: string, nextArg: string | undefined): number => {
  if (arg === '--config') return 2;

  if (arg === '--file') {
    if (nextArg) state.files.push(nextArg);

    return 2;
  }

  if (arg === '--async') {
    state.draft.mode = 'async';

    return 1;
  }

  if (arg === '--stream-live') {
    state.draft.stream_live = true;

    return 1;
  }

  if (arg === '--include-structured') {
    state.draft.include_structured = true;

    return 1;
  }

  if (arg === '--job-id') {
    state.draft.action = 'status';
    state.draft.job_id = nextArg;

    return 2;
  }

  return 0;
};

const tokenizeArgs = (args: string[]): ParseState => {
  const state: ParseState = { draft: {}, files: [] };

  for (let i = 0; i < args.length;) {
    const arg = args[i] ?? '';
    const nextArg = args[i + 1];
    const isValueFlag = parseValueFlag(state, arg, nextArg);

    if (isValueFlag) {
      i += 2;
      continue;
    }

    const skip = parseSpecialFlags(state, arg, nextArg);

    if (skip) {
      i += skip;
      continue;
    }

    const isFlag = arg.startsWith('--');

    if (arg && !isFlag && state.draft.prompt === undefined) {
      state.draft.prompt = arg;
    }

    i += 1;
  }

  return state;
};

const assignDefined = <TKey extends AskArgKey>(draft: AskArgsDraft, key: TKey, value: AskArgsDraft[TKey]): void => {
  if (value === undefined) return;

  draft[key] = value;
};

const buildAskToolArgs = (state: ParseState): AskToolArgs => {
  const result: AskArgsDraft = {};

  for (const key of ASK_ARG_KEYS) {
    assignDefined(result, key, state.draft[key]);
  }

  if (state.files.length > 0) {
    result.files = state.files;
  }

  return result;
};

export const parseAskArgs = (args: string[]): AskToolArgs => {
  const state = tokenizeArgs(args);
  const result = buildAskToolArgs(state);

  return result;
};

export const parseAskAllArgs = (args: string[]): AskAllToolArgs => {
  const normalizedArgs = normalizeAskAllArgs(args);

  validateAskAllFlags(normalizedArgs);
  const askArgs = parseAskArgs(normalizedArgs);
  const result = buildAskAllToolArgs({ askArgs, normalizedArgs });

  return result;
};
