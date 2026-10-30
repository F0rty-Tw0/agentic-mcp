import type { ReviewToolArgs } from '../../ask/common';
import { ValidationError } from '../../shared';

type ReviewParseState = {
  readonly scope?: string;
  readonly commit?: string;
  readonly base?: string;
  readonly model?: string;
  readonly workingDirectory?: string;
  readonly streamLive?: boolean;
};

type ReviewParseDraft = { -readonly [TKey in keyof ReviewParseState]: ReviewParseState[TKey] };

type ReviewValueKey = 'scope' | 'commit' | 'base' | 'model' | 'workingDirectory';

const REVIEW_VALUE_FLAGS: Readonly<Record<string, ReviewValueKey>> = {
  '--scope': 'scope',
  '--commit': 'commit',
  '--base': 'base',
  '--model': 'model',
  '--working-dir': 'workingDirectory',
};

const tokenizeReviewArgs = (args: string[]): ReviewParseState => {
  const state: ReviewParseDraft = {};

  for (let index = 0; index < args.length;) {
    const arg = args[index];
    const nextArg = args[index + 1];
    const isValueFlag = arg !== undefined && Object.hasOwn(REVIEW_VALUE_FLAGS, arg);
    const stateKey = isValueFlag ? REVIEW_VALUE_FLAGS[arg] : undefined;

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

  return state;
};

const validateReviewScope = (scope?: string): ReviewToolArgs['scope'] => {
  if (!scope) throw new ValidationError('review commands require --scope');

  if (scope === 'uncommitted' || scope === 'commit' || scope === 'range') return scope;

  throw new ValidationError(`Invalid review scope "${scope}". Allowed: uncommitted, commit, range`);
};

export const parseReviewArgs = (args: string[]): ReviewToolArgs => {
  const state = tokenizeReviewArgs(args);
  const scope = validateReviewScope(state.scope);
  const emptyArgs = {};
  const commitEntry = { commit: state.commit };
  const baseEntry = { base: state.base };
  const modelEntry = { model: state.model };
  const workingDirectoryEntry = { working_directory: state.workingDirectory };
  const commitArgs = state.commit ? commitEntry : emptyArgs;
  const baseArgs = state.base ? baseEntry : emptyArgs;
  const modelArgs = state.model ? modelEntry : emptyArgs;
  const workingDirectoryArgs = state.workingDirectory ? workingDirectoryEntry : emptyArgs;
  const result: ReviewToolArgs = {
    scope,
    stream_live: state.streamLive !== false,
    ...commitArgs,
    ...baseArgs,
    ...modelArgs,
    ...workingDirectoryArgs,
  };

  return result;
};
