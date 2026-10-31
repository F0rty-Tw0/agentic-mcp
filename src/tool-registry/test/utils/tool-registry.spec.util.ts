import { vi } from 'vitest';

import type { ProgressContext } from '../../../shared/mcp-protocol/common';
import type { ProviderConfig, ResolvedProvider, ResolvedProviderEntry } from '../../../shared/provider/common';
import type { ToolRequestContext } from '../../common';
import {
  TOOL_REGISTRY_PROVIDER_CONFIG_STUB,
  TOOL_REGISTRY_RESOLVED_PROVIDER_ENTRY_STUB,
  TOOL_REGISTRY_RESOLVED_PROVIDER_STUB,
} from '../stubs/tool-registry.stub';

type ToolRequestNotify = ToolRequestContext['mcpReq']['notify'];

export const makeConfig = (): ProviderConfig => {
  const providerConfig: ProviderConfig = { ...TOOL_REGISTRY_PROVIDER_CONFIG_STUB };

  return providerConfig;
};

export const makeProvider = (name = 'claude'): ResolvedProviderEntry => {
  const config = makeConfig();
  const resolvedProviderEntry: ResolvedProviderEntry = {
    ...TOOL_REGISTRY_RESOLVED_PROVIDER_ENTRY_STUB,
    name,
    binaryPath: `/usr/bin/${name}`,
    config,
  };

  return resolvedProviderEntry;
};

export const makeResolvedProvider = (name = 'claude'): ResolvedProvider => {
  const resolvedProvider: ResolvedProvider = {
    ...TOOL_REGISTRY_RESOLVED_PROVIDER_STUB,
    name,
    description: `${name} provider`,
    binaryPath: `/usr/bin/${name}`,
  };

  return resolvedProvider;
};

export const makeToolRequestContext = (): ToolRequestContext => {
  const meta = { progressToken: 'progress-token-1' };
  const abortController = new AbortController();
  const notify = vi.fn<ToolRequestNotify>().mockResolvedValue(undefined);
  const mcpReq: ToolRequestContext['mcpReq'] = {
    id: 'request-1',
    ['_meta']: meta,
    signal: abortController.signal,
    notify,
  };
  const toolRequestContext: ToolRequestContext = { mcpReq };

  return toolRequestContext;
};

export const makeExpectedProgressContext = (ctx: ToolRequestContext): ProgressContext => {
  const { _meta: requestMeta, id, notify, signal } = ctx.mcpReq;
  const progressContext: ProgressContext = {
    sendNotification: notify,
    ['_meta']: requestMeta,
    signal,
    requestId: id,
  };

  return progressContext;
};
