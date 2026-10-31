import type { SessionMode } from '../../session/common';
import type { ExecutionResult } from '../../shared/command-execution/common';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import type { ProviderAttribution } from '../common';

type AttributionMetadata = {
  readonly outputFormatObserved: OutputFormat;
};

type BuildAttributionInput = {
  readonly provider: string;
  readonly model?: string;
  readonly result: Pick<ExecutionResult, 'executionTimeMs' | 'truncated' | 'stdoutBytes'>;
  readonly outputFormat: OutputFormat;
  readonly metadata?: AttributionMetadata;
  readonly sessionMode: SessionMode;
  readonly warning?: string;
};

export const buildAttribution = (buildAttributionInput: BuildAttributionInput): ProviderAttribution => {
  const { provider, model, result, outputFormat, metadata, sessionMode, warning } = buildAttributionInput;
  const attributedSessionMode = sessionMode !== 'none' ? sessionMode : undefined;
  const noWarning = {};
  const warningPatch = { warning };
  const warningContent = warning !== undefined ? warningPatch : noWarning;
  const attribution: ProviderAttribution = {
    provider,
    model,
    executionTimeMs: result.executionTimeMs,
    outputBytes: result.stdoutBytes,
    truncated: result.truncated,
    outputFormat,
    sessionMode: attributedSessionMode,
    outputFormatObserved: metadata?.outputFormatObserved,
    ...warningContent,
  };

  return attribution;
};
