import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ToolDefinition } from '../../../shared/mcp-protocol/common';
import type { ProviderConfig, ResolvedProvider, ResolvedProviderEntry } from '../../../shared/provider/common';

const flags = { model: '-m' };
const ask = { args: ['exec'], flags };
const commands = { ask };
const input: ProviderConfig['input'] = { method: 'positional' };

export const TOOL_REGISTRY_PROVIDER_CONFIG_STUB: ProviderConfig = {
  enabled: true,
  description: 'test provider',
  command: 'test-cli',
  timeout: 30_000,
  env: {},
  outputFormat: 'text',
  commands,
  input,
};

export const TOOL_REGISTRY_RESOLVED_PROVIDER_ENTRY_STUB: ResolvedProviderEntry = {
  name: 'claude',
  binaryPath: '/usr/bin/claude',
  config: TOOL_REGISTRY_PROVIDER_CONFIG_STUB,
};

export const TOOL_REGISTRY_RESOLVED_PROVIDER_STUB: ResolvedProvider = {
  name: 'claude',
  description: 'claude provider',
  enabled: true,
  available: true,
  binaryPath: '/usr/bin/claude',
};

const content: CallToolResult['content'] = [{ type: 'text', text: 'ok' }];

export const TOOL_REGISTRY_SUCCESS_CALL_TOOL_RESULT_STUB: CallToolResult = {
  content,
};

const annotations = { readOnlyHint: true, idempotentHint: true };

export const TOOL_REGISTRY_PROVIDER_METRICS_TOOL_DEFINITION_STUB: ToolDefinition = {
  name: 'provider_metrics',
  description: 'See how many times each AI provider was called overall, with response times and success rates',
  annotations,
};
