import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ResolvedProviderEntry } from '../../shared';
import type { AskAllResult } from '../common';

const NO_MODEL = 'no-model';

export const makeProvider = (
  name: string,
  config: Partial<ResolvedProviderEntry['config']> = {}
): ResolvedProviderEntry => {
  const provider: ResolvedProviderEntry = {
    name,
    binaryPath: `/usr/bin/${name}`,
    config: config as ResolvedProviderEntry['config'],
  };

  return provider;
};

export const makeSuccessResult = (text: string): CallToolResult => {
  const result: CallToolResult = {
    content: [{ type: 'text', text }],
    isError: false,
  };

  return result;
};

export const makeErrorResult = (text: string): CallToolResult => {
  const result: CallToolResult = {
    content: [{ type: 'text', text }],
    isError: true,
  };

  return result;
};

export const parseResult = (result: CallToolResult): AskAllResult => {
  const structuredContent = result.structuredContent;

  if (!structuredContent) {
    throw new Error('Expected structuredContent to be defined');
  }

  return structuredContent as AskAllResult;
};

export const EXPLICIT_SHARED_MODEL = 'claude-sonnet-4';

const EXPLICIT_MODEL_RESULTS: Readonly<Record<string, CallToolResult>> = {
  [`gemini:${EXPLICIT_SHARED_MODEL}`]: makeErrorResult('ModelNotFoundError: Requested entity was not found.'),
  [`gemini:${NO_MODEL}`]: makeSuccessResult('gemini ok'),
};

const resolveExplicitModelKey = (model?: string): string => model ?? NO_MODEL;

export const resolveExplicitModelResult = (providerName: string, model?: string): CallToolResult => {
  if (providerName === 'codex') return makeSuccessResult('codex ok');

  const resultKey = `${providerName}:${resolveExplicitModelKey(model)}`;
  const result = EXPLICIT_MODEL_RESULTS[resultKey];

  if (result) return result;

  throw new Error(`Unexpected call for ${providerName}`);
};
