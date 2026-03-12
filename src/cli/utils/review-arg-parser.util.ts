import type { ReviewToolArgs } from '../../ask';
import { ValidationError } from '../../shared';

type ReviewParseState = Readonly<{
  scope?: ReviewToolArgs['scope'];
  commit?: string;
  base?: string;
  model?: string;
  workingDirectory?: string;
  streamLive?: boolean;
}>;

const REVIEW_VALUE_FLAGS: Readonly<Record<string, keyof ReviewParseState>> = {
  '--scope': 'scope',
  '--commit': 'commit',
  '--base': 'base',
  '--model': 'model',
  '--working-dir': 'workingDirectory',
};

const tokenizeReviewArgs = (args: readonly string[]): ReviewParseState => {
  const state: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; ) {
    const arg = args[index];
    const nextArg = args[index + 1];
    const stateKey = arg ? REVIEW_VALUE_FLAGS[arg] : undefined;

    if (arg === '--stream-live') {
      state.streamLive = true;
      index += 1;

      continue;
    }

    if (!stateKey) {
      index += 1;

      continue;
    }

    if (nextArg) {
      state[stateKey] = nextArg;
    }

    index += 2;
  }

  return state as ReviewParseState;
};

const validateReviewScope = (scope?: string): ReviewToolArgs['scope'] => {
  if (!scope) throw new ValidationError('review commands require --scope');

  if (scope === 'uncommitted' || scope === 'commit' || scope === 'range') return scope;

  throw new ValidationError(`Invalid review scope "${scope}". Allowed: uncommitted, commit, range`);
};

export const parseReviewArgs = (args: readonly string[]): ReviewToolArgs => {
  const state = tokenizeReviewArgs(args);
  const scope = validateReviewScope(state.scope);
  const result: ReviewToolArgs = {
    scope,
    stream_live: state.streamLive !== false,
    ...(state.commit ? { commit: state.commit } : {}),
    ...(state.base ? { base: state.base } : {}),
    ...(state.model ? { model: state.model } : {}),
    ...(state.workingDirectory ? { working_directory: state.workingDirectory } : {}),
  };

  return result;
};
