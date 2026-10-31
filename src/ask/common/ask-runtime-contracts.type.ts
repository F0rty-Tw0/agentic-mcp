import type { AskToolArgs } from './tool-args.type';
import type { SessionMode } from '../../session/common';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import type { CommandDef, ResolvedProviderEntry } from '../../shared/provider/common';
import type { AskStreamExecutionSummary, StreamNotifier } from '../../streaming/common';

export type ResolvedAskCommand = {
  readonly command: CommandDef;
  readonly outputFormat: OutputFormat;
};

export type ProviderJsonRecord = Readonly<Record<string, unknown>>;

export type ProviderOutputMetadata = {
  readonly outputFormatObserved: OutputFormat;
  readonly parsed?: unknown;
};

export type ParsedProviderOutput = {
  readonly text: string;
  readonly metadata?: ProviderOutputMetadata;
};

export type ProviderLiveOutputAdapter = {
  readonly onStdoutChunk: (chunk: string) => void;
  readonly onStderrChunk: (chunk: string) => void;
  readonly flush: () => void;
};

type AskEnv = Readonly<Record<string, string>>;

export type SuccessResponseInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly env: AskEnv;
  readonly stdout: string;
  readonly stderr: string;
  readonly executionTimeMs: number;
  readonly truncated: boolean;
  readonly stdoutBytes: number;
  readonly outputFormat: OutputFormat;
  readonly streamNotifier: StreamNotifier;
  readonly summary: AskStreamExecutionSummary;
  readonly sessionMode: SessionMode;
};
