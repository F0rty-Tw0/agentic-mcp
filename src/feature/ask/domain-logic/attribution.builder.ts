import type { ExecutionResult } from '../../../shared/common/command-executor.types.ts';
import type { ProviderAttribution } from '../common/attribution.types.ts';
import type { SessionMode } from '../common/session-mode.type.ts';

type AttributionMetadata = Readonly<{
  outputFormatObserved: 'text' | 'json' | 'stream-json';
}>;

type BuildAttributionInput = Readonly<{
  provider: string;
  model: string | undefined;
  result: Pick<ExecutionResult, 'executionTimeMs' | 'truncated' | 'stdoutBytes'>;
  outputFormat: 'json' | 'stream-json' | 'text';
  metadata: AttributionMetadata | undefined;
  sessionMode: SessionMode;
}>;

export const buildAttribution = ({
  provider,
  model,
  result,
  outputFormat,
  metadata,
  sessionMode,
}: BuildAttributionInput): ProviderAttribution => {
  const attribution: ProviderAttribution = {
    provider,
    ...(model !== undefined ? { model } : {}),
    executionTimeMs: result.executionTimeMs,
    outputBytes: result.stdoutBytes,
    truncated: result.truncated,
    outputFormat,
    ...(sessionMode !== 'none' ? { sessionMode } : {}),
    ...(metadata !== undefined ? { outputFormatObserved: metadata.outputFormatObserved } : {}),
  };

  return attribution;
};
