import { buildAskAllToolArgs, normalizeAskAllArgs, validateAskAllFlags } from './ask-all-arg-parser.util';
import type { AskToolArgs } from '../../ask';
import type { AskAllToolArgs } from '../../ask-all';

type ParseState = {
  prompt?: string;
  model?: string;
  workingDirectory?: string;
  autoMode?: string;
  systemPrompt?: string;
  effort?: string;
  maxBudget?: string;
  context?: string;
  sessionId?: string;
  streamLive?: boolean;
  includeStructured?: boolean;
  mode?: 'async';
  action?: 'status';
  jobId?: string;
  files: string[];
  [key: string]: string | boolean | string[] | undefined;
};

const VALUE_FLAGS: Readonly<Record<string, keyof ParseState>> = {
  '--model': 'model',
  '--working-dir': 'workingDirectory',
  '--auto-mode': 'autoMode',
  '--system-prompt': 'systemPrompt',
  '--effort': 'effort',
  '--max-budget': 'maxBudget',
  '--context': 'context',
  '--session-id': 'sessionId',
};

const parseValueFlag = (state: ParseState, flag: string, value: string): boolean => {
  const key = VALUE_FLAGS[flag];

  if (!key) return false;

  state[key] = value;

  return true;
};

const parseSpecialFlags = (state: ParseState, arg: string, nextArg: string | undefined): number => {
  if (arg === '--config') return 2;

  if (arg === '--file') {
    if (nextArg) state.files.push(nextArg);

    return 2;
  }

  if (arg === '--async') {
    state.mode = 'async';

    return 1;
  }

  if (arg === '--stream-live') {
    state.streamLive = true;

    return 1;
  }

  if (arg === '--include-structured') {
    state.includeStructured = true;

    return 1;
  }

  if (arg === '--job-id') {
    state.action = 'status';
    state.jobId = nextArg;

    return 2;
  }

  return 0;
};

const tokenizeArgs = (args: readonly string[]): ParseState => {
  const state: ParseState = { files: [] };

  for (let i = 0; i < args.length; ) {
    const arg = args[i] as string;
    const nextArg = args[i + 1] as string;

    if (parseValueFlag(state, arg, nextArg)) {
      i += 2;
      continue;
    }

    const skip = parseSpecialFlags(state, arg, nextArg);

    if (skip) {
      i += skip;
      continue;
    }

    if (arg && !arg.startsWith('--') && state.prompt === undefined) {
      state.prompt = arg;
    }

    i += 1;
  }

  return state;
};

const STATE_TO_ARG_MAP: readonly (readonly [keyof ParseState, string])[] = [
  ['prompt', 'prompt'],
  ['model', 'model'],
  ['workingDirectory', 'working_directory'],
  ['autoMode', 'auto_mode'],
  ['systemPrompt', 'system_prompt'],
  ['effort', 'effort'],
  ['maxBudget', 'max_budget'],
  ['context', 'context'],
  ['sessionId', 'session_id'],
  ['streamLive', 'stream_live'],
  ['includeStructured', 'include_structured'],
  ['mode', 'mode'],
  ['action', 'action'],
  ['jobId', 'job_id'],
];

const buildAskToolArgs = (state: ParseState): AskToolArgs => {
  const result: Record<string, unknown> = {};

  for (const [stateKey, argKey] of STATE_TO_ARG_MAP) {
    if (state[stateKey] !== undefined) {
      result[argKey] = state[stateKey];
    }
  }

  if (state.files.length > 0) {
    result.files = state.files;
  }

  return result as AskToolArgs;
};

export const parseAskArgs = (args: readonly string[]): AskToolArgs => {
  const state = tokenizeArgs(args);
  const result = buildAskToolArgs(state);

  return result;
};

export const parseAskAllArgs = (args: readonly string[]): AskAllToolArgs => {
  const normalizedArgs = normalizeAskAllArgs(args);

  validateAskAllFlags(normalizedArgs);
  const askArgs = parseAskArgs(normalizedArgs);
  const result = buildAskAllToolArgs({ askArgs, normalizedArgs });

  return result;
};
