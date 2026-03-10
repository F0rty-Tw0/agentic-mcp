import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { extractNativeSessionId } from '../../session';
import type { SessionMode } from '../../session';
import type { OutputFormat, ResolvedProviderEntry } from '../../shared';
import { stripAnsi } from '../../shared';

export type AskExecution = Readonly<{
  response: CallToolResult;
  sessionMode: SessionMode;
  responseText: string;
  nativeSessionId?: string;
  wasCancelled: boolean;
}>;

export const buildFailureExecution = (response: CallToolResult, wasCancelled: boolean): AskExecution => ({
  response,
  sessionMode: 'none',
  responseText: '',
  wasCancelled,
});

export const buildExecution = (
  response: CallToolResult,
  stdout: string,
  outputFormat: OutputFormat,
  context: ResolvedProviderEntry
): AskExecution => {
  const firstContent = response.content[0];

  return {
    response,
    sessionMode: 'none',
    responseText: firstContent?.type === 'text' ? firstContent.text : '',
    nativeSessionId: extractNativeSessionId(context.name, stripAnsi(stdout), outputFormat),
    wasCancelled: false,
  };
};
