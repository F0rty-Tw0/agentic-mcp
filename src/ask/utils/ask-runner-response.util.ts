import type { CallToolResult } from '@modelcontextprotocol/server';

import { extractNativeSessionId } from '../../session';
import { stripAnsi } from '../../shared';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { AskExecution } from '../common';

export const buildFailureExecution = (
  response: CallToolResult,
  wasCancelled: boolean,
  wasStopped = false
): AskExecution => {
  const result: AskExecution = {
    response,
    sessionMode: 'none',
    responseText: '',
    wasCancelled,
    wasStopped,
  };

  return result;
};

export const buildExecution = (
  response: CallToolResult,
  stdout: string,
  outputFormat: OutputFormat,
  context: ResolvedProviderEntry
): AskExecution => {
  const firstContent = response.content[0];

  const responseText = firstContent?.type === 'text' ? firstContent.text : '';
  const result: AskExecution = {
    response,
    sessionMode: 'none',
    responseText,
    nativeSessionId: extractNativeSessionId(context.name, stripAnsi(stdout), outputFormat),
    wasCancelled: false,
  };

  return result;
};
