import type { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';

import { ASK_PROVIDER_CONFIG_STUB } from '../../../ask/test/stubs/ask-provider-config.stub';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../../shared/provider/common';
import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/provider/common';
import type { AskAllResult } from '../../common';
import { EXPLICIT_SHARED_MODEL } from '../common/ask-all-handler.const';

const NO_MODEL = 'no-model';

export const makeProvider = (name: string, config: Partial<ProviderConfig> = {}): ResolvedProviderEntry => {
  const providerConfig: ProviderConfig = {
    ...ASK_PROVIDER_CONFIG_STUB,
    timeout: DEFAULT_MCP_TOOL_TIMEOUT_MS,
    ...config,
  };
  const provider: ResolvedProviderEntry = {
    name,
    binaryPath: `/usr/bin/${name}`,
    config: providerConfig,
  };

  return provider;
};

export const makeSuccessResult = (text: string): CallToolResult => {
  const content: TextContent[] = [{ type: 'text', text }];
  const result: CallToolResult = {
    content,
    isError: false,
  };

  return result;
};

export const makeErrorResult = (text: string): CallToolResult => {
  const content: TextContent[] = [{ type: 'text', text }];
  const result: CallToolResult = {
    content,
    isError: true,
  };

  return result;
};

const isAskAllResult = (value: unknown): value is AskAllResult => {
  const isObject = typeof value === 'object' && value !== null;

  return isObject && 'results' in value && Array.isArray(value.results);
};

export const parseResult = (result: CallToolResult): AskAllResult => {
  const structuredContent = result.structuredContent;

  if (!isAskAllResult(structuredContent)) throw new Error('Expected structuredContent to be an ask_all result');

  return structuredContent;
};

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
