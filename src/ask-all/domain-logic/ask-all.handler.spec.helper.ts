import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const NO_MODEL = 'no-model';

const makeSuccessResult = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
  isError: false,
});

const makeErrorResult = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
  isError: true,
});

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
