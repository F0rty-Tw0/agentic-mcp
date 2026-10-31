import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';

import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { AskAllProviderResult } from '../common';

export const buildErrorResult = (text: string): CallToolResult => {
  const content: TextContent[] = [{ type: 'text', text }];
  const result: CallToolResult = {
    isError: true,
    content,
  };

  return result;
};

export const buildProviderFailure = (
  provider: ResolvedProviderEntry,
  executionTimeMs: number,
  error: string
): AskAllProviderResult => {
  const result: AskAllProviderResult = {
    provider: provider.name,
    success: false,
    executionTimeMs,
    error,
  };

  return result;
};

export const buildProviderSuccess = (
  provider: ResolvedProviderEntry,
  executionTimeMs: number,
  response: string
): AskAllProviderResult => {
  const result: AskAllProviderResult = {
    provider: provider.name,
    success: true,
    executionTimeMs,
    response,
  };

  return result;
};

export const buildProviderTimeoutMessage = (providerName: string, timeoutMs: number): string =>
  `ask_all provider "${providerName}" timed out after ${timeoutMs}ms`;
