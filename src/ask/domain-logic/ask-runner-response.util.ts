import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { resolveModelHint } from './ask-handler';
import { buildAttribution } from './attribution.builder';
import { extractNativeSessionId } from '../../session/session-id-extractor';
import type { ResolvedProviderEntry } from '../../shared/common';
import { stripAnsi } from '../../shared/utils';
import type { AskToolArgs, SessionMode } from '../common';
import type { buildExecutionSummary, createStreamNotifier } from '../streaming/domain-logic';
import { buildCappedOutput } from '../utils';
import { parseProviderOutput } from '../utils/output-parser.util';

export type AskExecution = Readonly<{
  response: CallToolResult;
  sessionMode: SessionMode;
  responseText: string;
  nativeSessionId?: string;
  wasCancelled: boolean;
}>;

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

export const buildFailureExecution = (response: CallToolResult, wasCancelled: boolean): AskExecution => ({
  response,
  sessionMode: 'none',
  responseText: '',
  wasCancelled,
});

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

export const buildExecution = (
  response: CallToolResult,
  stdout: string,
  context: ResolvedProviderEntry
): AskExecution => {
  const firstContent = response.content[0];

  return {
    response,
    sessionMode: 'none',
    responseText: firstContent?.type === 'text' ? firstContent.text : '',
    nativeSessionId: extractNativeSessionId(context.name, stripAnsi(stdout), context.config.outputFormat),
    wasCancelled: false,
  };
};
