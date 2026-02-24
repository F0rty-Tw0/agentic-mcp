import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import {
  buildCappedOutput,
  resolveModelHint,
} from './ask-handler.util.ts';
import type { buildExecutionSummary, createStreamNotifier } from './ask-stream-notifier.util.ts';
import { buildAttribution } from './attribution.builder.ts';
import { parseProviderOutput } from './output-parser.util.ts';
import type { ResolvedProviderEntry } from '../../shared/common/index.ts';
import type { AskToolArgs, SessionMode } from '../common/index.ts';

type Env = Readonly<Record<string, string>>;

export type SuccessResponseInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  env: Env;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  truncated: boolean;
  stdoutBytes: number;
  streamNotifier: ReturnType<typeof createStreamNotifier>;
  summary: ReturnType<typeof buildExecutionSummary>;
  sessionMode: SessionMode;
}>;

export const buildSuccessfulResponse = async ({
  context,
  args,
  env,
  stdout,
  stderr,
  executionTimeMs,
  truncated,
  stdoutBytes,
  streamNotifier,
  summary,
  sessionMode,
}: SuccessResponseInput): Promise<CallToolResult> => {
  const parsedOutput = parseProviderOutput(stdout, context.config.outputFormat);
  const modelHint = await resolveModelHint({ context, args, stdout: parsedOutput.text, stderr, env });

  if (modelHint) {
    streamNotifier.emitError('Model validation failed', summary);

    return { isError: true, content: [{ type: 'text', text: parsedOutput.text + modelHint }] };
  }

  streamNotifier.emitDone(summary);
  const attribution = buildAttribution({
    provider: context.name,
    model: args.model,
    result: { executionTimeMs, truncated, stdoutBytes },
    outputFormat: context.config.outputFormat,
    metadata: parsedOutput.metadata,
    sessionMode,
  });
  const content = [
    { type: 'text' as const, text: buildCappedOutput(parsedOutput.text) || '(no output)' },
    { type: 'text' as const, text: JSON.stringify(attribution, null, 2) },
  ];

  return { content };
};
