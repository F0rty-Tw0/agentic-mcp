import type { OutputFormat } from '../../shared/mcp-protocol/common';

export type AskToolArgs = {
  readonly action?: 'run' | 'status';
  readonly context?: string;
  readonly prompt?: string;
  readonly mode?: 'sync' | 'async';
  readonly model?: string;
  readonly session_id?: string;
  readonly working_directory?: string;
  readonly files?: string[];
  readonly stream_live?: boolean;
  readonly include_structured?: boolean;
  readonly job_id?: string;
  readonly auto_mode?: string | boolean;
  readonly sandbox?: string | boolean;
  readonly effort?: string;
  readonly max_budget?: string;
  readonly system_prompt?: string;
};

export type ReviewScope = 'uncommitted' | 'commit' | 'range';

export type ReviewToolArgs = {
  readonly scope: ReviewScope;
  readonly commit?: string;
  readonly base?: string;
  readonly model?: string;
  readonly working_directory?: string;
  readonly stream_live?: boolean;
  readonly include_structured?: boolean;
};

export type BuiltArgs = {
  readonly args: string[];
  readonly stdinInput?: string;
  readonly outputFormat: OutputFormat;
};
