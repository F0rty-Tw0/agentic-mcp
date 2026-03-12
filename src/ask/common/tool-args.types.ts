import type { FlagValue, OutputFormat } from '../../shared';

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
  include_structured?: boolean;
  job_id?: string;
  auto_mode?: string | boolean;
  sandbox?: string | boolean;
  effort?: string;
  max_budget?: string;
  system_prompt?: string;
}>;

export type ReviewScope = 'uncommitted' | 'commit' | 'range';

export type ReviewToolArgs = Readonly<{
  scope: ReviewScope;
  commit?: string;
  base?: string;
  model?: string;
  working_directory?: string;
  stream_live?: boolean;
  include_structured?: boolean;
}>;

export type BuiltArgs = Readonly<{
  args: readonly string[];
  stdinInput?: string;
  outputFormat: OutputFormat;
}>;

type LeveledFlag = { flag: string; values: string[] };

export const isLeveledFlag = (value: FlagValue): value is LeveledFlag => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};
