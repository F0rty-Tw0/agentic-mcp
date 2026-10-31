import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';

import { resolveModelHint } from './ask-command';
import { buildAttribution } from './attribution.builder';
import type { SessionMode } from '../../session/common';
import type { AskToolStructuredContent, ProviderAttribution, SuccessResponseInput } from '../common';
import { buildCappedOutput, parseProviderOutput } from '../utils';

type BuildStructuredContentInput = {
  readonly responseText: string;
  readonly attribution: ProviderAttribution;
  readonly sessionMode: SessionMode;
  readonly includeStructured?: boolean;
  readonly parsed?: unknown;
};

const buildStructuredContent = (
  buildStructuredContentInput: BuildStructuredContentInput
): AskToolStructuredContent | undefined => {
  const { responseText, attribution, sessionMode, includeStructured, parsed } = buildStructuredContentInput;

  if (!includeStructured) return;

  const noContent = {};
  const parsedPatch = { parsed };
  const sessionModePatch = { sessionMode };
  const parsedContent = parsed !== undefined ? parsedPatch : noContent;
  const sessionModeContent = sessionMode !== 'none' ? sessionModePatch : noContent;
  const structuredContent: AskToolStructuredContent = {
    response: responseText,
    attribution,
    ...parsedContent,
    ...sessionModeContent,
  };

  return structuredContent;
};

const buildModelHintFailure = (parsedText: string, modelHint: string): CallToolResult => {
  const errorContent: TextContent[] = [{ type: 'text', text: parsedText + modelHint }];
  const callToolResult: CallToolResult = {
    isError: true,
    content: errorContent,
  };

  return callToolResult;
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

    return buildModelHintFailure(parsedOutput.text, modelHint);
  }

  streamNotifier.emitDone(summary);
  const result = { executionTimeMs, truncated, stdoutBytes };
  const buildAttributionInput = {
    provider: context.name,
    model: args.model,
    result,
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
  const contentResult: CallToolResult = { content };

  if (!structuredContent) return contentResult;

  const callToolResult: CallToolResult = { content, structuredContent };

  return callToolResult;
};
