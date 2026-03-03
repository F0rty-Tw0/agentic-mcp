import type { ExecutionResult, OutputFormat } from '../../shared';
import type { ProviderAttribution } from '../common/attribution.types';
import type { SessionMode } from '../common/session-mode.type';

type AttributionMetadata = Readonly<{
  outputFormatObserved: OutputFormat;
}>;

type BuildAttributionInput = Readonly<{
  provider: string;
  model?: string;
  result: Pick<ExecutionResult, 'executionTimeMs' | 'truncated' | 'stdoutBytes'>;
  outputFormat: OutputFormat;
  metadata?: AttributionMetadata;
  sessionMode: SessionMode;
}>;

export const buildAttribution = (buildAttributionInput: BuildAttributionInput): ProviderAttribution => {
  const { provider, model, result, outputFormat, metadata, sessionMode } = buildAttributionInput;

  const attribution: ProviderAttribution = {
    provider,
    model,
    executionTimeMs: result.executionTimeMs,
    outputBytes: result.stdoutBytes,
    truncated: result.truncated,
    outputFormat,
    sessionMode: sessionMode !== 'none' ? sessionMode : undefined,
    outputFormatObserved: metadata?.outputFormatObserved,
  };

  return attribution;
};
