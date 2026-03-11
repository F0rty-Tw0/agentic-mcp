import type { AskToolArgs } from './tool-args.types';
import type { SessionMode } from '../../session';
import type { CommandDef, OutputFormat, ResolvedProviderEntry } from '../../shared';
import type { AskStreamExecutionSummary, StreamNotifier } from '../../streaming';

export type ResolvedAskCommand = Readonly<{
  command: CommandDef;
  outputFormat: OutputFormat;
}>;

export type ParsedProviderOutput = Readonly<{
  text: string;
  metadata?: Readonly<{
    outputFormatObserved: OutputFormat;
    parsed?: unknown;
  }>;
}>;

export type ProviderLiveOutputAdapter = Readonly<{
  onStdoutChunk: (chunk: string) => void;
  onStderrChunk: (chunk: string) => void;
  flush: () => void;
}>;

type AskEnv = Readonly<Record<string, string>>;

export type SuccessResponseInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  env: AskEnv;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  truncated: boolean;
  stdoutBytes: number;
  outputFormat: OutputFormat;
  streamNotifier: StreamNotifier;
  summary: AskStreamExecutionSummary;
  sessionMode: SessionMode;
}>;
