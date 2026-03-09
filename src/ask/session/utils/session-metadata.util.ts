import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { SessionMode } from '../../common';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const appendSessionMetadata = (response: CallToolResult, sessionMode: SessionMode): CallToolResult => {
  if (sessionMode === 'none' || !isRecord(response.structuredContent)) return response;

  const existingStructuredContent = response.structuredContent;
  const existingAttribution = existingStructuredContent.attribution;
  const withAttribution = isRecord(existingAttribution) ? { attribution: { ...existingAttribution, sessionMode } } : {};

  const structuredContent = {
    ...existingStructuredContent,
    sessionMode,
    ...withAttribution,
  };
  const callToolResult: CallToolResult = { ...response, structuredContent };

  return callToolResult;
};
