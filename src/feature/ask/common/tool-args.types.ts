import type { FlagValue } from '../../../shared/common/index.ts';

export type AskToolArgs = Readonly<{
  action?: 'run' | 'status';
  context?: string;
  prompt?: string;
  mode?: 'sync' | 'async';
  model?: string;
  session_id?: string;
  working_directory?: string;
  files?: readonly string[];
  stream_live?: boolean;
  job_id?: string;
  auto_mode?: string | boolean;
  sandbox?: string | boolean;
  effort?: string;
  max_budget?: string;
  system_prompt?: string;
}>;

export type BuiltArgs = Readonly<{
  args: readonly string[];
  stdinInput?: string;
}>;

type LeveledFlag = { flag: string; values: string[] };

export const isLeveledFlag = (value: FlagValue): value is LeveledFlag => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};
