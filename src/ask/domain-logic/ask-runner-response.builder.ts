import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { resolveModelHint } from './ask-command';
import { buildAttribution } from './attribution.builder';
import type { SessionMode } from '../../session';
import type { OutputFormat, ResolvedProviderEntry } from '../../shared';
import type { AskStreamExecutionSummary, StreamNotifier } from '../../streaming';
import type { AskToolArgs, AskToolStructuredContent, ProviderAttribution } from '../common';
import { buildCappedOutput, parseProviderOutput } from '../utils';

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
  outputFormat: OutputFormat;
  streamNotifier: StreamNotifier;
  summary: AskStreamExecutionSummary;
  sessionMode: SessionMode;
}>;

type BuildStructuredContentInput = Readonly<{
  responseText: string;
  attribution: ProviderAttribution;
  sessionMode: SessionMode;
  includeStructured?: boolean;
  parsed?: unknown;
}>;

const buildStructuredContent = (
  buildStructuredContentInput: BuildStructuredContentInput
): AskToolStructuredContent | undefined => {
  const { responseText, attribution, sessionMode, includeStructured, parsed } = buildStructuredContentInput;

  if (!includeStructured) return;

  const parsedContent = parsed !== undefined ? { parsed } : {};
  const sessionModeContent = sessionMode !== 'none' ? { sessionMode } : {};
  const structuredContent: AskToolStructuredContent = {
    response: responseText,
    attribution,
    ...parsedContent,
    ...sessionModeContent,
  };

  return structuredContent;
};

export const buildSuccessfulResponse = async (successResponseInput: SuccessResponseInput): Promise<CallToolResult> => {
  const {
    context,
    args,
    env,
    stdout,
    stderr,
    executionTimeMs,
    truncated,
    stdoutBytes,
    outputFormat,
    streamNotifier,
    summary,
    sessionMode,
  } = successResponseInput;
  const parsedOutput = parseProviderOutput(stdout, outputFormat);
  const modelHint = await resolveModelHint({ context, args, stdout: parsedOutput.text, stderr, env });

  if (modelHint) {
    streamNotifier.emitError('Model validation failed', summary);

    const callToolResult: CallToolResult = {
      isError: true,
      content: [{ type: 'text', text: parsedOutput.text + modelHint }],
    };

    return callToolResult;
  }

  streamNotifier.emitDone(summary);
  const buildAttributionInput = {
    provider: context.name,
    model: args.model,
    result: { executionTimeMs, truncated, stdoutBytes },
    outputFormat,
    metadata: parsedOutput.metadata,
    sessionMode,
  };
  const attribution = buildAttribution(buildAttributionInput);
  const responseText = buildCappedOutput(parsedOutput.text) || '(no output)';
  const structuredContent = buildStructuredContent({
    responseText,
    attribution,
    sessionMode,
    includeStructured: args.include_structured,
    parsed: parsedOutput.metadata?.parsed,
  });
  const content: CallToolResult['content'] = [{ type: 'text', text: responseText }];
  const callToolResult: CallToolResult = structuredContent ? { content, structuredContent } : { content };

  return callToolResult;
};
